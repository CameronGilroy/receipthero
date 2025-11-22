import { XeroClient } from 'xero-node';
import {
  XeroAccount,
  XeroAccountsResponse,
  XeroConnection,
  CachedAccounts
} from './types';

export class XeroAPIClient {
  private client: XeroClient;
  private connection: XeroConnection | null = null;

  constructor() {
    if (!process.env.XERO_CLIENT_ID || !process.env.XERO_CLIENT_SECRET) {
      throw new Error('XERO_CLIENT_ID and XERO_CLIENT_SECRET environment variables are required');
    }

    // Get the base URL for redirect URIs
    const baseUrl = process.env.NEXTAUTH_URL ||
                   process.env.VERCEL_URL ?
                   `https://${process.env.VERCEL_URL}` :
                   'http://localhost:3000';

    const redirectUri = `${baseUrl}/api/xero/auth`;

    console.log('Xero Client Debug - Constructor config:', {
      clientId: process.env.XERO_CLIENT_ID.substring(0, 10) + '...', // Partial for security
      baseUrl,
      redirectUri,
      scopes: ['openid', 'email', 'profile', 'offline_access', 'accounting.settings.read'],
    });

    this.client = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID,
      clientSecret: process.env.XERO_CLIENT_SECRET,
      redirectUris: [redirectUri],
      grantType: 'authorization_code',
      scopes: ['openid', 'email', 'profile', 'offline_access', 'accounting.settings.read'],
    });
  }

  /**
   * Generate OAuth2 authorization URL for user consent
   */
  async generateAuthUrl(state?: string): Promise<string> {
    console.log('Xero Client Debug - About to build consent URL');
    const authUrl = await this.client.buildConsentUrl();
    console.log('Xero Client Debug - Generated auth URL:', authUrl);
    const finalUrl = state ? `${authUrl}&state=${encodeURIComponent(state)}` : authUrl;
    return finalUrl;
  }

  /**
   * Exchange authorization code for access tokens
   */
  async exchangeCodeForTokens(code: string): Promise<XeroConnection> {
    try {
      await this.client.initialize();
      console.log('About to call apiCallback with code:', code.substring(0, 20) + '...');
      await this.client.apiCallback(code);
      console.log('apiCallback completed');

      // Access tokenSet from the client after callback
      const tokenSet = (this.client as any).tokenSet;
      console.log('Token set after callback:', {
        hasTokenSet: !!tokenSet,
        hasAccessToken: !!tokenSet?.access_token,
        accessTokenPrefix: tokenSet?.access_token ? tokenSet.access_token.substring(0, 10) + '...' : 'undefined'
      });

      if (!tokenSet?.access_token) {
        console.error('Token set missing access_token:', tokenSet);
        throw new Error('Failed to obtain access tokens from Xero');
      }

      // Get tenant information using the new token
      await this.client.updateTenants(false);

      if (!this.client.tenants || this.client.tenants.length === 0) {
        throw new Error('No Xero organizations found for this user');
      }

      const tenant = this.client.tenants[0]; // Use first tenant (most common case)

      this.connection = {
        tenantId: tenant.tenantId,
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token || '',
        expiresAt: Date.now() + (tokenSet.expires_in || 1800) * 1000,
        tenantName: tenant.tenantName || 'Unnamed Organization'
      };

      return this.connection;
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw new Error(`Xero authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(): Promise<XeroConnection> {
    if (!this.connection?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const tokenSet = await this.client.refreshToken();

      if (!tokenSet.access_token) {
        throw new Error('Failed to refresh access token');
      }

      this.connection = {
        ...this.connection,
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token || this.connection.refreshToken,
        expiresAt: Date.now() + (tokenSet.expires_in || 1800) * 1000,
      };

      return this.connection;
    } catch (error) {
      console.error('Error refreshing tokens:', error);
      throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set connection data (used when loading from storage)
   */
  setConnection(connection: XeroConnection): void {
    this.connection = connection;

    // Set token set in Xero client
    const tokenSet = {
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken,
      expires_in: Math.floor((connection.expiresAt - Date.now()) / 1000),
      token_type: 'Bearer'
    };

    this.client.setTokenSet(tokenSet);
  }

  /**
   * Check if currently authenticated and tokens are valid
   */
  isAuthenticated(): boolean {
    return !!(
      this.connection &&
      this.connection.accessToken &&
      this.connection.expiresAt > Date.now() + 300000 // 5 minutes buffer
    );
  }

  /**
   * Fetch all active accounts from Xero with optional filtering
   */
  async getAccounts(params?: {
    where?: string;
    order?: string;
    page?: number;
    includeArchived?: boolean;
  }): Promise<XeroAccountsResponse> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Xero. Please connect your account first.');
    }

    // Refresh tokens if needed
    if (this.connection && this.connection.expiresAt < Date.now() + 300000) {
      await this.refreshTokens();
    }

    try {
      await this.client.setTokenSet({
        access_token: this.connection!.accessToken,
        refresh_token: this.connection!.refreshToken,
        token_type: 'Bearer'
      });

      const response = await this.client.accountingApi.getAccounts(
        this.connection!.tenantId,
        undefined, // page parameter (optional date, using undefined)
        params?.where,
        params?.order
      );

      const accounts = (response.body.accounts || []).map(account => this.mapSDKAccountToXeroAccount(account));

      return {
        Accounts: accounts as XeroAccount[],
        Pagination: {
          page: params?.page || 1,
          pageSize: accounts.length,
          pageCount: 1, // Xero doesn't provide pagination info in this endpoint
          totalCount: accounts.length
        }
      };
    } catch (error) {
      console.error('Error fetching accounts from Xero:', error);
      throw new Error(`Failed to fetch accounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get account by ID
   */
  async getAccount(accountId: string): Promise<XeroAccount | null> {
    try {
      const response = await this.getAccounts({
        where: `AccountID=="${accountId}"`
      });

      return response.Accounts[0] || null;
    } catch (error) {
      console.error('Error fetching account:', error);
      return null;
    }
  }

  /**
   * Get expense accounts only (filtered by type)
   */
  async getExpenseAccounts(): Promise<XeroAccountsResponse> {
    return this.getAccounts({
      where: 'Type=="EXPENSE"',
      includeArchived: false
    });
  }

  /**
   * Search accounts by name or code
   */
  searchAccounts(query: string, accounts: XeroAccount[]): XeroAccount[] {
    const lowerQuery = query.toLowerCase();
    return accounts.filter(account =>
      account.Name.toLowerCase().includes(lowerQuery) ||
      account.Code.toLowerCase().includes(lowerQuery) ||
      (account.Description && account.Description.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get current connection info
   */
  getConnection(): XeroConnection | null {
    return this.connection;
  }

  /**
   * disconnect from Xero (clear connection data)
   */
  disconnect(): void {
    this.connection = null;
  }

  /**
   * Map Xero SDK Account to our XeroAccount type
   */
  private mapSDKAccountToXeroAccount(account: any): XeroAccount {
    return {
      AccountID: account.accountID,
      Code: account.code,
      Name: account.name,
      Type: account.type,
      TaxType: account.taxType,
      EnablePaymentsToAccount: account.enablePaymentsToAccount || false,
      ShowInExpenseClaims: account.showInExpenseClaims || false,
      Class: account.class,
      Status: account.status,
      HasAttachments: account.hasAttachments || false,
      Description: account.description,
      BankAccountNumber: account.bankAccountNumber,
      BankAccountType: account.bankAccountType,
      CurrencyCode: account.currencyCode,
      ReportingCode: account.reportingCode,
      ReportingCodeName: account.reportingCodeName,
    };
  }
}

import { XeroAPIClient } from '../lib/xero-client';
import { XeroConnection } from '../lib/types';

// Mock fetch globally
global.fetch = jest.fn();

// Mock XeroClient from xero-node
jest.mock('xero-node', () => ({
  XeroClient: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    buildConsentUrl: jest.fn().mockResolvedValue('https://login.xero.com/authorize?client_id=338649194BB6453AA83DFAF701E3A611'),
    updateTenants: jest.fn().mockResolvedValue(undefined),
    setTokenSet: jest.fn(),
    refreshToken: jest.fn().mockResolvedValue({
      access_token: 'mock_refreshed_access_token',
      refresh_token: 'mock_new_refresh_token',
      expires_in: 1800,
      token_type: 'Bearer'
    }),
    tenants: [{ tenantId: 'mock_tenant_id', tenantName: 'Mock Organization' }],
    accountingApi: {
      getAccounts: jest.fn().mockResolvedValue({
        body: {
          accounts: [{
            accountID: 'mock_account_id',
            code: '400',
            name: 'Mock Expense Account',
            type: 'EXPENSE',
            taxType: 'INPUT',
            enablePaymentsToAccount: false,
            showInExpenseClaims: true,
            class: 'EXPENSE',
            status: 'ACTIVE',
            hasAttachments: false,
            description: 'Mock account for testing',
            bankAccountNumber: null,
            bankAccountType: null,
            currencyCode: 'USD',
            reportingCode: null,
            reportingCodeName: null
          }]
        }
      })
    }
  }))
}));

// Mock Xero token response
const mockTokenResponse = {
  access_token: 'mock_access_token',
  refresh_token: 'mock_refresh_token',
  expires_in: 1800,
  token_type: 'Bearer'
};

describe('XeroAPIClient', () => {
  let client: XeroAPIClient;

  beforeEach(() => {
    // Set required environment variables
    process.env.XERO_CLIENT_ID = '338649194BB6453AA83DFAF701E3A611';
    process.env.XERO_CLIENT_SECRET = 'Lk4mnsn3cK1L7nztxsSrxzq1zscY2gXLvMqN0qUkrYTosnBm';

    client = new XeroAPIClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance with correct configuration', () => {
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(XeroAPIClient);
    });

    it('should throw error if environment variables are missing', () => {
      delete process.env.XERO_CLIENT_ID;
      delete process.env.XERO_CLIENT_SECRET;

      expect(() => new XeroAPIClient()).toThrow(
        'XERO_CLIENT_ID and XERO_CLIENT_SECRET environment variables are required'
      );
    });
  });

  describe('generateAuthUrl', () => {
    it('should generate authorization URL', async () => {
      const url = await client.generateAuthUrl('test_state');

      expect(url).toContain('https://login.xero.com/authorize?client_id=338649194BB6453AA83DFAF701E3A611');
      expect(url).toContain('state=test_state');
    });

    it('should work without state parameter', async () => {
      const url = await client.generateAuthUrl();

      expect(url).toBe('https://login.xero.com/authorize?client_id=338649194BB6453AA83DFAF701E3A611');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange authorization code for tokens successfully', async () => {
      // Mock successful fetch response for token exchange
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockTokenResponse,
      } as any);

      const code = 'mock_authorization_code';
      const connection = await client.exchangeCodeForTokens(code);

      expect(connection).toBeDefined();
      expect(connection.accessToken).toBe('mock_access_token');
      expect(connection.refreshToken).toBe('mock_refresh_token');
      expect(connection.tenantId).toBe('mock_tenant_id');
      expect(connection.tenantName).toBe('Mock Organization');

      // Verify fetch was called with correct parameters
      expect(global.fetch).toHaveBeenCalledWith('https://identity.xero.com/connect/token', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': expect.stringContaining('Basic'), // Check auth header format
        }),
        body: expect.any(URLSearchParams),
      }));
    });

    it('should throw error if token exchange fails', async () => {
      // Mock failed response from Xero token endpoint
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid grant',
      } as any);

      await expect(client.exchangeCodeForTokens('invalid_code')).rejects.toThrow(
        'Xero authentication failed: Xero token exchange failed: 400 Bad Request'
      );
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no connection exists', () => {
      expect(client.isAuthenticated()).toBe(false);
    });

    it('should return true when valid connection exists', async () => {
      const connection: XeroConnection = {
        tenantId: 'mock_tenant_id',
        accessToken: 'valid_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() + 3600000, // 1 hour from now
        tenantName: 'Mock Organization'
      };

      client.setConnection(connection);
      expect(client.isAuthenticated()).toBe(true);
    });

    it('should return false when access token is expired', async () => {
      const connection: XeroConnection = {
        tenantId: 'mock_tenant_id',
        accessToken: 'valid_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() - 1000, // Expired 1 second ago
        tenantName: 'Mock Organization'
      };

      client.setConnection(connection);
      expect(client.isAuthenticated()).toBe(false);
    });
  });

  describe('getAccounts', () => {
    it('should throw error when not authenticated', async () => {
      await expect(client.getAccounts()).rejects.toThrow(
        'Not authenticated with Xero. Please connect your account first.'
      );
    });

    it('should fetch accounts successfully when authenticated', async () => {
      const connection: XeroConnection = {
        tenantId: 'mock_tenant_id',
        accessToken: 'valid_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() + 3600000,
        tenantName: 'Mock Organization'
      };

      client.setConnection(connection);

      const response = await client.getAccounts();

      expect(response).toBeDefined();
      expect(response.Accounts).toHaveLength(1);
      expect(response.Accounts[0].Name).toBe('Mock Expense Account');
    });
  });

  describe('disconnect', () => {
    it('should clear connection data', async () => {
      const connection: XeroConnection = {
        tenantId: 'mock_tenant_id',
        accessToken: 'valid_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() + 3600000,
        tenantName: 'Mock Organization'
      };

      client.setConnection(connection);
      expect(client.isAuthenticated()).toBe(true);

      client.disconnect();
      expect(client.isAuthenticated()).toBe(false);
      expect(client.getConnection()).toBeNull();
    });
  });
});

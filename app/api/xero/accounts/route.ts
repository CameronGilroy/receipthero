import { NextResponse } from 'next/server';
import { XeroAPIClient } from '@/lib/xero-client';
import { XeroStorageManager } from '@/lib/xero-storage';

const xeroClient = new XeroAPIClient();
import { z } from 'zod';

// Schema for account filter parameters
const accountQuerySchema = z.object({
  type: z.enum(['EXPENSE', 'INCOME', 'ALL']).optional().default('EXPENSE'),
  refresh: z.boolean().optional().default(false),
});

// GET /api/xero/accounts - Fetch Xero accounts
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'EXPENSE' | 'INCOME' | 'ALL' | null;
    const refresh = searchParams.get('refresh') === 'true';

    // Check authentication
    if (!XeroStorageManager.isAuthenticated()) {
      return NextResponse.json(
        { error: 'Not authenticated with Xero. Please connect your account first.' },
        { status: 401 }
      );
    }

    const tenantInfo = XeroStorageManager.getTenantInfo();
    if (!tenantInfo?.tenantId) {
      return NextResponse.json(
        { error: 'No tenant ID found. Please reconnect to Xero.' },
        { status: 400 }
      );
    }

    // Check if we have cached accounts and don't need to refresh
    if (!refresh) {
      const cachedAccounts = XeroStorageManager.getCachedAccounts(tenantInfo.tenantId);
      if (cachedAccounts && cachedAccounts.length > 0) {
        return NextResponse.json({
          accounts: cachedAccounts,
          cached: true,
          cacheAge: XeroStorageManager.getCacheAge(tenantInfo.tenantId)
        });
      }
    }

    // Set connection in client
    const connection = XeroStorageManager.getConnection();
    if (connection) {
      xeroClient.setConnection(connection);
    }

    // Fetch accounts from Xero
    let accountsResponse;

    if (type === 'ALL') {
      accountsResponse = await xeroClient.getAccounts();
    } else {
      // Filter by type for better performance
      const accountType = type || 'EXPENSE';
      accountsResponse = await xeroClient.getAccounts({
        where: `Type=="${accountType}"`,
        includeArchived: false
      });
    }

    // Cache the accounts
    XeroStorageManager.saveAccountsCache(accountsResponse.Accounts, tenantInfo.tenantId);

    return NextResponse.json({
      accounts: accountsResponse.Accounts,
      cached: false,
      count: accountsResponse.Accounts.length
    });

  } catch (error) {
    console.error('Error fetching Xero accounts:', error);

    // Return cached accounts if available as fallback
    const tenantInfo = XeroStorageManager.getTenantInfo();
    if (tenantInfo?.tenantId) {
      const cachedAccounts = XeroStorageManager.getCachedAccounts(tenantInfo.tenantId);
      if (cachedAccounts && cachedAccounts.length > 0) {
        return NextResponse.json({
          accounts: cachedAccounts,
          cached: true,
          fallback: true,
          error: error instanceof Error ? error.message : 'Failed to fetch from Xero'
        });
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch accounts from Xero',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/xero/accounts/match - Match receipts to accounts
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { receipts } = body;

    if (!Array.isArray(receipts) || receipts.length === 0) {
      return NextResponse.json(
        { error: 'Receipts array is required' },
        { status: 400 }
      );
    }

    // Check authentication
    if (!XeroStorageManager.isAuthenticated()) {
      return NextResponse.json(
        { error: 'Not authenticated with Xero. Please connect your account first.' },
        { status: 401 }
      );
    }

    // Get accounts (from cache or Xero)
    let accounts = XeroStorageManager.getCachedAccounts();
    if (!accounts || accounts.length === 0) {
      // Try to fetch fresh accounts
      const tenantInfo = XeroStorageManager.getTenantInfo();
      if (tenantInfo?.tenantId) {
        const connection = XeroStorageManager.getConnection();
        if (connection) {
          xeroClient.setConnection(connection);

          const accountsResponse = await xeroClient.getExpenseAccounts();
          accounts = accountsResponse.Accounts;

          // Cache for future use
          XeroStorageManager.saveAccountsCache(accounts, tenantInfo.tenantId);
        }
      }
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json(
        { error: 'No Xero accounts available. Please try reconnecting to Xero.' },
        { status: 404 }
      );
    }

    // Import account matcher dynamically to avoid issues
    const { AccountMatcher } = await import('@/lib/xero-account-matcher');

    // Prepare receipt data for matching
    const receiptsForMatching = receipts.map(receipt => ({
      category: receipt.category,
      description: receipt.description || receipt.vendor
    }));

    // Perform AI-powered matching
    const matches = await AccountMatcher.matchReceiptCategoriesToAccounts(
      receiptsForMatching,
      accounts
    );

    // Get matching statistics
    const statistics = AccountMatcher.getMatchStatistics(matches);

    return NextResponse.json({
      matches,
      statistics,
      originalReceipts: receipts.length,
      matchedAccounts: matches.length
    });

  } catch (error) {
    console.error('Error matching receipts to accounts:', error);
    return NextResponse.json(
      {
        error: 'Failed to match receipts to accounts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { XeroAPIClient } from '@/lib/xero-client';
import { XeroStorageManager } from '@/lib/xero-storage';

const xeroClient = new XeroAPIClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  console.log('Xero Auth Debug:', {
    hasCode: !!code,
    state,
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
  });

  try {
    if (code) {
      // Handle OAuth2 callback - exchange code for tokens
      const connection = await xeroClient.exchangeCodeForTokens(code);

      // Store connection securely in the user's session/client storage
      XeroStorageManager.saveConnection(connection);

      // Redirect back to the receipts page with success
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('xero_connected', 'true');
      redirectUrl.searchParams.set('tenant_name', connection.tenantName);

      return NextResponse.redirect(redirectUrl);

    } else {
      // No code provided - redirect to Xero for authorization
      const authUrl = await xeroClient.generateAuthUrl('connect-xero');

      // Redirect to Xero OAuth2 authorization page
      return NextResponse.redirect(authUrl);
    }

  } catch (error) {
    console.error('Xero authentication error:', error);

    // Redirect back with error
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('xero_error', 'true');
    redirectUrl.searchParams.set('error_message', error instanceof Error ? error.message : 'Authentication failed');

    return NextResponse.redirect(redirectUrl);
  }
}

export async function DELETE(request: Request) {
  try {
    // Disconnect from Xero
    xeroClient.disconnect();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Xero disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect from Xero' },
      { status: 500 }
    );
  }
}

// GET /api/xero/auth/status - Check authentication status
export async function POST(request: Request) {
  try {
    const isAuthenticated = XeroStorageManager.isAuthenticated();
    const tenantInfo = XeroStorageManager.getTenantInfo();

    return NextResponse.json({
      authenticated: isAuthenticated,
      tenant: tenantInfo
    });
  } catch (error) {
    console.error('Xero status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check authentication status' },
      { status: 500 }
    );
  }
}

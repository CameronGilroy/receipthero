# Implementation Plan

Fix Xero OAuth2 token exchange issue where access token becomes undefined after authorization callback.

The Xero authentication flow is malfunctioning during token exchange. When exchanging the OAuth2 authorization code for access tokens, the token retrieval mechanism fails, causing the access token to be undefined. This prevents successful Xero API integration.

[Types]
Single sentence describing the type system changes.

No new type definitions needed.

Existing XeroConnection type remains unchanged:
```typescript
export interface XeroConnection {
  tenantId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tenantName: string;
}
```

[Files]
Single sentence describing file modifications.

lib/xero-client.ts - Update exchangeCodeForTokens method to use getTokenSet() instead of private property access.

Detailed breakdown:
- New files: None
- Existing files: lib/xero-client.ts modified
- Configuration files: No changes
- Files deleted: None

[Functions]
Single sentence describing function modifications.

Modify exchangeCodeForTokens method in XeroAPIClient class to use public getTokenSet method.

Detailed breakdown:
- New functions: None
- Modified functions: exchangeCodeForTokens (lib/xero-client.ts: line ~58-70)
- Removed functions: None

[Classes]
Single sentence describing class modifications.

No class modifications required.

Detailed breakdown:
- New classes: None
- Modified classes: XeroAPIClient (internal method logic only)
- Removed classes: None

[Dependencies]
Single sentence describing dependency modifications.

No dependency modifications required.

Details of new packages: None
Version changes: None
Integration requirements: None

[Testing]
Single sentence describing testing approach.

Verify OAuth2 flow works from authorization to token exchange to connection establishment.

Test file requirements: None (manual testing of OAuth2 flow)
Existing test modifications: None
Validation strategies: Manual testing with Xero OAuth2, check console logs for token retrieval

[Implementation Order]
Single sentence describing the implementation sequence.

Update token retrieval method and test the complete OAuth2 authentication flow.

Numbered steps:
1. Modify token retrieval in exchangeCodeForTokens method
2. Test the OAuth2 flow end-to-end

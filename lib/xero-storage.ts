import { XeroConnection, CachedAccounts, XeroAccount } from './types';

export class XeroStorageManager {
  private static readonly CONNECTION_KEY = 'xero-connection';
  private static readonly ACCOUNTS_CACHE_KEY = 'xero-accounts-cache';
  private static readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  // Server-side storage since localStorage is not available in API routes
  private static readonly serverStorage = new Map<string, any>();

  /**
   * Check if we're running on the server (no window object)
   */
  private static isServer(): boolean {
    return typeof window === 'undefined';
  }

  /**
   * Get value from appropriate storage
   */
  private static getItem(key: string): string | null {
    if (this.isServer()) {
      return this.serverStorage.get(key) || null;
    }
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  /**
   * Set value in appropriate storage
   */
  private static setItem(key: string, value: string): void {
    if (this.isServer()) {
      this.serverStorage.set(key, value);
      return;
    }
    try {
      localStorage.setItem(key, value);
    } catch {
      // Silently fail on client-side storage errors
    }
  }

  /**
   * Remove value from appropriate storage
   */
  private static removeItem(key: string): void {
    if (this.isServer()) {
      this.serverStorage.delete(key);
      return;
    }
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently fail on client-side storage errors
    }
  }

  /**
   * Save Xero connection data
   */
  static saveConnection(connection: XeroConnection): void {
    try {
      this.setItem(this.CONNECTION_KEY, JSON.stringify(connection));
    } catch (error) {
      console.error('Failed to save Xero connection:', error);
    }
  }

  /**
   * Load Xero connection data
   */
  static getConnection(): XeroConnection | null {
    try {
      const stored = this.getItem(this.CONNECTION_KEY);
      if (!stored) return null;

      const connection: XeroConnection = JSON.parse(stored);

      // Check if connection is still valid (with buffer)
      if (connection.expiresAt < Date.now() + 300000) { // 5 minutes buffer
        this.clearConnection();
        return null;
      }

      return connection;
    } catch (error) {
      console.error('Failed to load Xero connection:', error);
      this.clearConnection();
      return null;
    }
  }

  /**
   * Clear Xero connection data
   */
  static clearConnection(): void {
    try {
      this.removeItem(this.CONNECTION_KEY);
      this.clearAccountsCache();
    } catch (error) {
      console.error('Failed to clear Xero connection:', error);
    }
  }

  /**
   * Save accounts cache with expiration
   */
  static saveAccountsCache(accounts: XeroAccount[], tenantId: string): void {
    try {
      const cacheData: CachedAccounts = {
        accounts,
        lastFetched: Date.now(),
        tenantId,
        expiresAt: Date.now() + this.CACHE_DURATION
      };

      this.setItem(this.ACCOUNTS_CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Failed to save accounts cache:', error);
    }
  }

  /**
   * Load accounts from cache if still valid
   */
  static getCachedAccounts(tenantId?: string): XeroAccount[] | null {
    try {
      const stored = this.getItem(this.ACCOUNTS_CACHE_KEY);
      if (!stored) return null;

      const cache: CachedAccounts = JSON.parse(stored);

      // Check if cache is still valid
      if (cache.expiresAt < Date.now()) {
        this.clearAccountsCache();
        return null;
      }

      // Check if cache is for the correct tenant
      if (tenantId && cache.tenantId !== tenantId) {
        return null;
      }

      return cache.accounts;
    } catch (error) {
      console.error('Failed to load accounts cache:', error);
      this.clearAccountsCache();
      return null;
    }
  }

  /**
   * Clear accounts cache
   */
  static clearAccountsCache(): void {
    try {
      this.removeItem(this.ACCOUNTS_CACHE_KEY);
    } catch (error) {
      console.error('Failed to clear accounts cache:', error);
    }
  }

  /**
   * Check if accounts cache exists and is valid for tenant
   */
  static hasValidCache(tenantId: string): boolean {
    const cached = this.getCachedAccounts(tenantId);
    return cached !== null && cached.length > 0;
  }

  /**
   * Get cache age in minutes
   */
  static getCacheAge(tenantId: string): number | null {
    try {
      const stored = this.getItem(this.ACCOUNTS_CACHE_KEY);
      if (!stored) return null;

      const cache: CachedAccounts = JSON.parse(stored);
      if (tenantId && cache.tenantId !== tenantId) return null;

      return Math.round((Date.now() - cache.lastFetched) / (1000 * 60));
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if user is authenticated (connection exists and is valid)
   */
  static isAuthenticated(): boolean {
    const connection = this.getConnection();
    return connection !== null;
  }

  /**
   * Get stored tenant information
   */
  static getTenantInfo(): { tenantId: string; tenantName: string } | null {
    const connection = this.getConnection();
    if (!connection) return null;

    return {
      tenantId: connection.tenantId,
      tenantName: connection.tenantName
    };
  }
}

// Utility function to check storage availability
export function isStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

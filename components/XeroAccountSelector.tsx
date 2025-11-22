"use client";

import { useState, useEffect } from 'react';
import { XeroAccount } from '@/lib/types';
import { Button } from '@/ui/button';

interface XeroAccountSelectorProps {
  accounts: XeroAccount[];
  selectedAccount?: XeroAccount;
  onAccountSelect: (account: XeroAccount) => void;
  onClose: () => void;
  loading?: boolean;
  title?: string;
}

export default function XeroAccountSelector({
  accounts,
  selectedAccount,
  onAccountSelect,
  onClose,
  loading = false,
  title = "Select Xero Account"
}: XeroAccountSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredAccounts, setFilteredAccounts] = useState<XeroAccount[]>(accounts);

  // Filter accounts based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredAccounts(accounts);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = accounts.filter(account =>
        account.Name.toLowerCase().includes(query) ||
        account.Code.toLowerCase().includes(query) ||
        (account.Description && account.Description.toLowerCase().includes(query))
      );
      setFilteredAccounts(filtered);
    }
  }, [searchQuery, accounts]);

  const handleAccountSelect = (account: XeroAccount) => {
    onAccountSelect(account);
    onClose();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading accounts...</span>
      </div>
    );
  }

  return (
    <div className="max-w-lg w-full">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-600 mt-1">
          Choose the appropriate Xero account for this expense
        </p>
      </div>

      {/* Search box */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search accounts by name or code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Account list */}
      <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
        {filteredAccounts.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchQuery ? 'No accounts match your search' : 'No accounts available'}
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredAccounts.map((account) => (
              <li key={account.AccountID}>
                <button
                  onClick={() => handleAccountSelect(account)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none ${
                    selectedAccount?.AccountID === account.AccountID
                      ? 'bg-blue-50 border-blue-200'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {account.Code}
                        </span>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {account.Name}
                        </span>
                      </div>
                      {account.Description && (
                        <p className="text-sm text-gray-500 mt-1 truncate">
                          {account.Description}
                        </p>
                      )}
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-gray-400">
                          {account.Type}
                        </span>
                        {account.TaxType && (
                          <span className="text-xs text-gray-400">
                            Tax: {account.TaxType}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end space-x-3 mt-4 pt-4 border-t border-gray-200">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        {selectedAccount && (
          <Button
            onClick={() => handleAccountSelect(selectedAccount)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Select {selectedAccount.Code} - {selectedAccount.Name}
          </Button>
        )}
      </div>

      {/* Statistics */}
      <div className="mt-3 text-xs text-gray-500">
        Showing {filteredAccounts.length} of {accounts.length} accounts
        {searchQuery && ` (filtered by "${searchQuery}")`}
      </div>
    </div>
  );
}

// Alternative compact version for dropdown use
interface XeroAccountDropdownProps {
  accounts: XeroAccount[];
  selectedAccount?: XeroAccount;
  onAccountSelect: (account: XeroAccount | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function XeroAccountDropdown({
  accounts,
  selectedAccount,
  onAccountSelect,
  placeholder = "Select account code...",
  disabled = false
}: XeroAccountDropdownProps) {
  return (
    <select
      value={selectedAccount?.AccountID || ''}
      onChange={(e) => {
        const selectedId = e.target.value;
        const account = accounts.find(acc => acc.AccountID === selectedId);
        onAccountSelect(account || null);
      }}
      disabled={disabled}
      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
    >
      <option value="">{placeholder}</option>
      {accounts.map(account => (
        <option key={account.AccountID} value={account.AccountID}>
          {account.Code} - {account.Name}
          {account.Description ? ` (${account.Description})` : ''}
        </option>
      ))}
    </select>
  );
}

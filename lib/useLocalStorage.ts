import { useState, useEffect } from 'react';
import { ProcessedReceipt, SpendingBreakdown } from './types';

interface StoredData {
  receipts: ProcessedReceipt[];
  breakdown: SpendingBreakdown | null;
  base64s: string[];
}

const STORAGE_KEY = 'receipt-hero-data';

export function useReceiptStorage() {
  const [processedReceipts, setProcessedReceipts] = useState<ProcessedReceipt[]>([]);
  const [spendingBreakdown, setSpendingBreakdown] = useState<SpendingBreakdown | null>(null);
  const [base64s, setBase64s] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data: StoredData = JSON.parse(stored);
        setProcessedReceipts(data.receipts || []);
        setSpendingBreakdown(data.breakdown || null);
        setBase64s(data.base64s || []);
      }
    } catch (error) {
      console.error('Failed to load data from localStorage:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save data to localStorage
  const saveToStorage = (receipts: ProcessedReceipt[], breakdown: SpendingBreakdown | null, base64s: string[] = []) => {
    try {
      const data: StoredData = {
        receipts,
        breakdown,
        base64s
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save data to localStorage:', error);
    }
  };

  // Update receipts and breakdown
  const updateReceipts = (receipts: ProcessedReceipt[], breakdown: SpendingBreakdown | null, base64s: string[] = []) => {
    setProcessedReceipts(receipts);
    setSpendingBreakdown(breakdown);
    setBase64s(base64s);
    saveToStorage(receipts, breakdown, base64s);
  };

  // Clear all data
  const clearStorage = () => {
    setProcessedReceipts([]);
    setSpendingBreakdown(null);
    setBase64s([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    processedReceipts,
    spendingBreakdown,
    base64s,
    isLoaded,
    updateReceipts,
    clearStorage
  };
}
import { z } from "zod";

// Schema for a processed receipt
export const ProcessedReceiptSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  date: z.string(),
  vendor: z.string(),
  category: z.string(),
  paymentMethod: z.string(),
  taxAmount: z.number(),
  amount: z.number(),
  currency: z.string().default('USD'),
  originalAmount: z.number().optional(),
  originalTaxAmount: z.number().optional(),
  exchangeRate: z.number().optional(),
  thumbnail: z.string(),
  base64: z.string(),
  mimeType: z.string(),
  // Additional fields for CSV export (optional)
  invoiceNumber: z.string().optional(),
  contactEmail: z.string().optional(),
  dueDate: z.string().optional(),
  inventoryItemCode: z.string().optional(),
  description: z.string().optional(),
  quantity: z.number().optional(),
  unitAmount: z.number().optional(),
  accountCode: z.string().optional(),
  taxType: z.string().optional(),
  trackingName1: z.string().optional(),
  trackingOption1: z.string().optional(),
  trackingName2: z.string().optional(),
  trackingOption2: z.string().optional(),
  poAddressLine1: z.string().optional(),
  poAddressLine2: z.string().optional(),
  poAddressLine3: z.string().optional(),
  poAddressLine4: z.string().optional(),
  poCity: z.string().optional(),
  poRegion: z.string().optional(),
  poPostalCode: z.string().optional(),
  poCountry: z.string().optional(),
});

// Type exports
export type ProcessedReceipt = z.infer<typeof ProcessedReceiptSchema>;

// Storage-optimized version without large base64 data
export interface StoredReceipt {
  id: string;
  fileName: string;
  date: string;
  vendor: string;
  category: string;
  paymentMethod: string;
  taxAmount: number;
  amount: number;
  currency?: string;
  originalAmount?: number;
  originalTaxAmount?: number;
  exchangeRate?: number;
  mimeType: string;
  // Additional fields for CSV export (optional)
  invoiceNumber?: string;
  contactEmail?: string;
  dueDate?: string;
  inventoryItemCode?: string;
  description?: string;
  quantity?: number;
  unitAmount?: number;
  accountCode?: string;
  taxType?: string;
  trackingName1?: string;
  trackingOption1?: string;
  trackingName2?: string;
  trackingOption2?: string;
  poAddressLine1?: string;
  poAddressLine2?: string;
  poAddressLine3?: string;
  poAddressLine4?: string;
  poCity?: string;
  poRegion?: string;
  poPostalCode?: string;
  poCountry?: string;
}

// Status for uploaded files
export type FileStatus = 'processing' | 'receipt' | 'not-receipt' | 'error';

export interface UploadedFile {
  id: string;
  name: string;
  file: File;
  status: FileStatus;
  receipt?: ProcessedReceipt;
  /** Error message - only present when status === 'error' */
  error?: string;
  base64?: string;
  mimeType?: string;
}

export interface SpendingCategory {
  name: string;
  amount: number;
  percentage: number;
}

export interface SpendingBreakdown {
  categories: SpendingCategory[];
}

// Enhanced receipt with additional fields for CSV export
export interface XeroReceiptExport extends ProcessedReceipt {
  // Xero required fields
  invoiceNumber?: string;
  contactEmail?: string;
  dueDate?: string;
  inventoryItemCode?: string;
  description?: string;
  quantity?: number;
  unitAmount?: number;
  accountCode?: string;
  taxType?: string;
  trackingName1?: string;
  trackingOption1?: string;
  trackingName2?: string;
  trackingOption2?: string;
  // PO Address fields
  poAddressLine1?: string;
  poAddressLine2?: string;
  poAddressLine3?: string;
  poAddressLine4?: string;
  poCity?: string;
  poRegion?: string;
  poPostalCode?: string;
  poCountry?: string;
}

// Export configuration state
export interface ExportConfig {
  receipts: ProcessedReceipt[];
  missingData: XeroReceiptExport[];
  exportReady: boolean;
}

// Export form state for user input
export interface ExportFormData {
  invoiceNumber: string;
  contactEmail: string;
  dueDate: string;
  accountCode: string;
  taxType: string;
  poAddressLine1: string;
  poAddressLine2: string;
  poCity: string;
  poRegion: string;
  poPostalCode: string;
  poCountry: string;
}

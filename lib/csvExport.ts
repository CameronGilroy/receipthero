import { ProcessedReceipt, XeroReceiptExport, ExportConfig } from './types';
import { formatCurrency } from './utils';

// Xero CSV header mapping - must match the exact order expected by Xero
const XERO_CSV_HEADERS = [
  '*ContactName',
  'EmailAddress',
  'POAddressLine1',
  'POAddressLine2',
  'POAddressLine3',
  'POAddressLine4',
  'POCity',
  'PORegion',
  'POPostalCode',
  'POCountry',
  '*InvoiceNumber',
  '*InvoiceDate',
  'DueDate',
  'InventoryItemCode',
  'Description',
  '*Quantity',
  '*UnitAmount',
  'AccountCode',
  'TaxType',
  'TrackingName1',
  'TrackingOption1',
  'TrackingName2',
  'TrackingOption2',
  'Currency'
];

// Category to Account Code mappings for common business expenses
const CATEGORY_TO_ACCOUNT_CODE: Record<string, string> = {
  groceries: '410',      // Office supplies / consumables
  dining: '421',         // Entertainment / meals
  gas: '413',            // Motor vehicle expenses
  healthcare: '411',     // Medical expenses
  shopping: '426',       // General expenses
  electronics: '426',    // General expenses
  home: '424',           // Repairs & maintenance
  clothing: '426',       // General expenses
  utilities: '430',      // Utilities
  entertainment: '421',  // Entertainment
  travel: '420',         // Travel expenses
  default: '426'         // General expenses as fallback
};

// Category to default account descriptions
const CATEGORY_TO_DESCRIPTION: Record<string, string> = {
  groceries: 'Office supplies and consumables',
  dining: 'Business meals and entertainment',
  gas: 'Motor vehicle fuel and expenses',
  healthcare: 'Medical and healthcare expenses',
  shopping: 'General business purchases',
  electronics: 'Technology and equipment purchases',
  home: 'Office repairs and maintenance',
  clothing: 'Business attire and uniforms',
  utilities: 'Utility bills and services',
  entertainment: 'Entertainment and events',
  travel: 'Business travel and accommodation',
  default: 'Business expense'
};

/**
 * Maps a ProcessedReceipt to Xero CSV format with intelligent field mapping
 */
function mapReceiptToXeroCSV(receipt: ProcessedReceipt): Record<string, string> {
  // Base mappings from existing receipt data
  const baseData = {
    ContactName: receipt.vendor,
    EmailAddress: receipt.contactEmail || '',
    POAddressLine1: receipt.poAddressLine1 || '',
    POAddressLine2: receipt.poAddressLine2 || '',
    POAddressLine3: receipt.poAddressLine3 || '',
    POAddressLine4: receipt.poAddressLine4 || '',
    POCity: receipt.poCity || '',
    PORegion: receipt.poRegion || '',
    POPostalCode: receipt.poPostalCode || '',
    POCountry: receipt.poCountry || '',
    InvoiceNumber: receipt.invoiceNumber || `RCP-${receipt.id.slice(-8).toUpperCase()}`,
    InvoiceDate: receipt.date,
    DueDate: receipt.dueDate || receipt.date, // Default to invoice date
    InventoryItemCode: receipt.inventoryItemCode || '',
    Description: receipt.description || generateDefaultDescription(receipt),
    Quantity: (receipt.quantity || 1).toString(),
    UnitAmount: formatCurrencyForCSV(receipt.amount / (receipt.quantity || 1), receipt.currency),
    AccountCode: receipt.accountCode || CATEGORY_TO_ACCOUNT_CODE[receipt.category] || CATEGORY_TO_ACCOUNT_CODE.default,
    TaxType: receipt.taxType || generateDefaultTaxType(receipt),
    TrackingName1: receipt.trackingName1 || '',
    TrackingOption1: receipt.trackingOption1 || '',
    TrackingName2: receipt.trackingName2 || '',
    TrackingOption2: receipt.trackingOption2 || '',
    Currency: receipt.currency
  };

  return baseData;
}

/**
 * Generates a default description when none is extracted
 */
function generateDefaultDescription(receipt: ProcessedReceipt): string {
  const desc = CATEGORY_TO_DESCRIPTION[receipt.category] || CATEGORY_TO_DESCRIPTION.default;
  return `${desc} - ${receipt.vendor}`;
}

/**
 * Generates a reasonable default tax type based on location and amount
 */
function generateDefaultTaxType(receipt: ProcessedReceipt): string {
  // For receipts with tax, try to determine type
  if (receipt.taxAmount > 0) {
    // This could be enhanced with location detection
    // For now, use generic tax type
    return 'GST';
  }
  return ''; // No tax
}

/**
 * Formats currency amount for CSV (no currency symbols, just numbers)
 */
function formatCurrencyForCSV(amount: number, currency: string): string {
  return amount.toFixed(2);
}

/**
 * Converts receipt array to Xero CSV format
 */
export function generateXeroCSV(receipts: ProcessedReceipt[], config: ExportConfig): string {
  const csvRows: string[] = [];

  // Add header row
  csvRows.push(XERO_CSV_HEADERS.join(','));

  // Filter out any receipts that don't have export ready data
  const exportableReceipts = receipts.filter((receipt, index) => {
    const exportData = config.missingData[index];
    if (!exportData) return true; // No export data missing, include receipt
    return config.exportReady; // Include if export is ready
  });

  // Add data rows
  for (const receipt of exportableReceipts) {
    const csvData = mapReceiptToXeroCSV(receipt);
    const row = XERO_CSV_HEADERS.map(header => {
      const key = header.replace('*', ''); // Remove asterisk for key lookup
      const value = csvData[key as keyof typeof csvData] || '';
      // Escape commas and quotes in values
      const escapedValue = `"${value.replace(/"/g, '""')}"`;
      return escapedValue;
    });
    csvRows.push(row.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Attempts to extract additional Xero fields from receipt data
 * This is a placeholder for future AI-powered extraction logic
 */
export async function extractXeroFieldsFromReceipt(receipt: ProcessedReceipt): Promise<Partial<XeroReceiptExport>> {
  // For now, return the existing data
  // Future: Use AI/ML to extract missing fields from receipt images
  const extracted: Partial<XeroReceiptExport> = {};

  // Apply intelligent defaults where possible
  if (!receipt.invoiceNumber) {
    extracted.invoiceNumber = `RCP-${receipt.id.slice(-8).toUpperCase()}`;
  }

  if (!receipt.dueDate) {
    extracted.dueDate = receipt.date; // Same as invoice date
  }

  if (!receipt.accountCode) {
    extracted.accountCode = CATEGORY_TO_ACCOUNT_CODE[receipt.category] || CATEGORY_TO_ACCOUNT_CODE.default;
  }

  if (!receipt.description) {
    extracted.description = generateDefaultDescription(receipt);
  }

  if (!receipt.quantity) {
    extracted.quantity = 1;
  }

  if (!receipt.unitAmount) {
    extracted.unitAmount = receipt.amount; // Total amount as unit amount for quantity=1
  }

  if (!receipt.taxType && receipt.taxAmount > 0) {
    extracted.taxType = generateDefaultTaxType(receipt);
  }

  return extracted;
}

/**
 * Validates if a receipt has all required Xero fields or identifies what's missing
 */
export function validateXeroExportData(receipts: ProcessedReceipt[]): ExportConfig {
  const missingData: XeroReceiptExport[] = [];
  let exportReady = true;

  for (const receipt of receipts) {
    const issues: Partial<XeroReceiptExport> = {};

    // Check required fields using camelCase property names
    if (!receipt.vendor?.trim()) {
      issues.vendor = '';
      exportReady = false;
    }
    if (!receipt.invoiceNumber && !receipt.id) {
      issues.invoiceNumber = '';
      exportReady = false;
    }
    if (!receipt.date) {
      issues.date = '';
      exportReady = false;
    }
    if (!receipt.amount || receipt.amount <= 0) {
      issues.amount = 0;
      exportReady = false;
    }
    if (!receipt.quantity || receipt.quantity <= 0) {
      issues.quantity = 1;
      exportReady = false;
    }

    missingData.push(issues as XeroReceiptExport);
  }

  return {
    receipts,
    missingData,
    exportReady
  };
}

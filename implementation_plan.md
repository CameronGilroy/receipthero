# Implementation Plan

[Overview]
Add CSV export functionality to export imported receipts in Xero accounting software compatible format.

This implementation will add a "Export to CSV" button to the receipts table interface that generates a CSV file conforming to Xero's invoice import format. The system will attempt to extract required fields from receipt images during OCR processing, with fallback user input forms for any missing data. This enables seamless integration between ReceiptHero and Xero for expense management and accounting workflows.

[Types]
Extend the type system to support Xero CSV export data structures and optional receipt enrichment fields.

**New Types:**
```typescript
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
```

**Validation Rules:**
- XeroReceiptExport must include all required Xero fields (marked with *)
- Currency must be valid 3-letter ISO code
- Dates must be in YYYY-MM-DD format
- Amounts must be positive decimal numbers

[Files]
Create new components and utilities for CSV export while modifying existing UI components to add export functionality.

**New Files:**
- `lib/csvExport.ts` - Core CSV generation logic with Xero format mapping
- `components/ExportDialog.tsx` - Modal dialog for user input of missing fields
- `app/api/export-csv/route.ts` - API endpoint for CSV file generation and download

**Modified Files:**
- `lib/types.ts` - Add new Xero export types
- `app/api/ocr/route.ts` - Enhance OCR prompt to extract additional CSV fields
- `lib/useReceiptManager.ts` - Add export functionality to receipt manager hook
- `components/TableReceipts.tsx` - Add export button to receipts table header
- `components/ReceiptDetailsDialog.tsx` - Add export option to individual receipt dialog

**Configuration Updates:**
- No package.json changes required (uses existing dependencies)
- No environment configuration changes needed

[Functions]
Add CSV export and data enrichment functions while modifying existing components to support the new functionality.

**New Functions:**
- `generateXeroCSV(receipts: ProcessorReceipt[], config: ExportConfig): string` in lib/csvExport.ts - Converts receipt array to Xero CSV format
- `extractXeroFieldsFromReceipt(receipt: ProcessedReceipt): Promise<Partial<XeroReceiptExport>>` in lib/csvExport.ts - Attempts to extract additional fields using AI/OCR heuristics
- `exportReceiptsToCSV(receipts: ProcessedReceipt[]): Promise<void>` in lib/useReceiptManager.ts - Main export workflow including user prompts
- `POST` handler in app/api/export-csv/route.ts - Generates and streams CSV file download
- `createExportDialog(missingData: XeroReceiptExport[])` in components/ExportDialog.tsx - Creates user input form for missing fields

**Modified Functions:**
- Enhanced OCR API in app/api/ocr/route.ts - Modify system prompt to scan for invoice numbers, line items, addresses, and other CSV fields
- `processFiles()` in lib/useReceiptManager.ts - Store additional extracted fields alongside basic receipt data
- `TableReceipts` component - Add export button to header actions
- `ReceiptDetailsDialog` component - Add individual export option

[Classes]
No new classes required; all functionality implemented with functional components and utility functions.

[Dependencies]
Existing dependencies are sufficient; no new packages needed for CSV export functionality.

The implementation leverages:
- Existing Zod schemas for validation
- Browser File API for CSV downloads
- OpenRouter AI for enhanced OCR extraction
- React state management for export workflow

[Testing]
Add unit tests for CSV export logic and integration tests for end-to-end export workflow.

**Test Requirements:**
- Unit tests for `generateXeroCSV()` function with various receipt data combinations
- Unit tests for field extraction logic in `extractXeroFieldsFromReceipt()`
- Integration tests for complete export workflow from button click to file download
- Test Xero CSV format compliance with sample data
- Test handling of missing fields and user input validation

**Existing Test Modifications:**
- No existing tests to modify (no test suite currently exists)

[Implementation Order]
Implement CSV export functionality in logical sequence starting with core utilities and API enhancements.

1. Extend `lib/types.ts` with Xero export types and interfaces
2. Enhance `app/api/ocr/route.ts` to extract additional CSV fields from receipts
3. Create `lib/csvExport.ts` with core CSV generation and field mapping logic
4. Add export functionality to `lib/useReceiptManager.ts` hook
5. Create `components/ExportDialog.tsx` for user input of missing data
6. Create `app/api/export-csv/route.ts` API endpoint for file download
7. Modify `components/TableReceipts.tsx` to add export button
8. Modify `components/ReceiptDetailsDialog.tsx` to add individual export option
9. Add comprehensive unit tests for CSV export functionality
10. Add integration tests for complete export workflow

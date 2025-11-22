"use client";

import { useState, useEffect } from "react";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProcessedReceipt, ExportFormData } from "@/lib/types";
import { generateXeroCSV, validateXeroExportData } from "@/lib/csvExport";

interface ExportDialogProps {
  receipts: ProcessedReceipt[];
  isOpen: boolean;
  onClose: () => void;
  onExport: (csvContent: string) => void;
}

export default function ExportDialog({ receipts, isOpen, onClose, onExport }: ExportDialogProps) {
  const [formData, setFormData] = useState<ExportFormData>({
    invoiceNumber: '',
    contactEmail: '',
    dueDate: '',
    accountCode: '',
    taxType: '',
    poAddressLine1: '',
    poAddressLine2: '',
    poCity: '',
    poRegion: '',
    poPostalCode: '',
    poCountry: '',
  });

  const [isExporting, setIsExporting] = useState(false);

  // Reset form data when dialog opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        invoiceNumber: '',
        contactEmail: '',
        dueDate: '',
        accountCode: '',
        taxType: '',
        poAddressLine1: '',
        poAddressLine2: '',
        poCity: '',
        poRegion: '',
        poPostalCode: '',
        poCountry: '',
      });
    }
  }, [isOpen]);

  const handleInputChange = (field: keyof ExportFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      // Create enhanced receipts with user-provided defaults
      const enhancedReceipts = receipts.map(receipt => ({
        ...receipt,
        invoiceNumber: receipt.invoiceNumber || formData.invoiceNumber || `RCP-${receipt.id.slice(-8).toUpperCase()}`,
        contactEmail: receipt.contactEmail || formData.contactEmail,
        dueDate: receipt.dueDate || formData.dueDate || receipt.date,
        accountCode: receipt.accountCode || formData.accountCode,
        taxType: receipt.taxType || formData.taxType,
        poAddressLine1: receipt.poAddressLine1 || formData.poAddressLine1,
        poAddressLine2: receipt.poAddressLine2 || formData.poAddressLine2,
        poCity: receipt.poCity || formData.poCity,
        poRegion: receipt.poRegion || formData.poRegion,
        poPostalCode: receipt.poPostalCode || formData.poPostalCode,
        poCountry: receipt.poCountry || formData.poCountry,
      }));

      // Validate and generate CSV
      const exportConfig = validateXeroExportData(enhancedReceipts);
      const csvContent = generateXeroCSV(enhancedReceipts, exportConfig);

      onExport(csvContent);
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Count receipts with missing data
  const missingCount = receipts.filter(receipt => {
    const config = validateXeroExportData([receipt]);
    return !config.exportReady;
  }).length;

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Complete Missing Export Information</DialogTitle>
          <DialogDescription>
            {missingCount} of {receipts.length} receipts need additional information to export to Xero CSV format.
            Enter default values below for any missing fields.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Default Invoice Prefix</label>
              <input
                type="text"
                placeholder="RCP-"
                value={formData.invoiceNumber}
                onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Contact Email</label>
              <input
                type="email"
                placeholder="contact@example.com"
                value={formData.contactEmail}
                onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Default Due Date</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => handleInputChange('dueDate', e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Account Code</label>
              <input
                type="text"
                placeholder="410"
                value={formData.accountCode}
                onChange={(e) => handleInputChange('accountCode', e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Tax Type</label>
            <select
              value={formData.taxType}
              onChange={(e) => handleInputChange('taxType', e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select tax type...</option>
              <option value="GST">GST</option>
              <option value="VAT">VAT</option>
              <option value="EXEMPT">Tax Exempt</option>
              <option value="NONE">No Tax</option>
            </select>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Purchase Order Address (Optional)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600">Address Line 1</label>
                <input
                  type="text"
                  value={formData.poAddressLine1}
                  onChange={(e) => handleInputChange('poAddressLine1', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">City</label>
                <input
                  type="text"
                  value={formData.poCity}
                  onChange={(e) => handleInputChange('poCity', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-gray-600">Region</label>
                <input
                  type="text"
                  value={formData.poRegion}
                  onChange={(e) => handleInputChange('poRegion', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Postal Code</label>
                <input
                  type="text"
                  value={formData.poPostalCode}
                  onChange={(e) => handleInputChange('poPostalCode', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Country</label>
                <input
                  type="text"
                  value={formData.poCountry}
                  onChange={(e) => handleInputChange('poCountry', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
            <strong>Note:</strong> These values will be applied as defaults for receipts missing this information.
            Individual receipts with extracted data will use their specific values.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Exporting...' : `Export ${receipts.length} Receipts`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

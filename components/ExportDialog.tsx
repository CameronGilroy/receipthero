"use client";

import { useState, useEffect } from "react";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProcessedReceipt, ExportFormData, XeroAccount } from "@/lib/types";
import { generateXeroCSV, validateXeroExportData, extractXeroFieldsFromReceipt } from "@/lib/csvExport";
import { XeroStorageManager } from "@/lib/xero-storage";
import { XeroAccountDropdown } from "./XeroAccountSelector";
import { useReceiptManager } from "@/lib/useReceiptManager";

interface ExportDialogProps {
  receipts: ProcessedReceipt[];
  isOpen: boolean;
  onClose: () => void;
  onExport: (csvContent: string) => void;
}

export default function ExportDialog({ receipts, isOpen, onClose, onExport }: ExportDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnectedToXero, setIsConnectedToXero] = useState(false);
  const [xeroTenantInfo, setXeroTenantInfo] = useState<{ tenantId: string; tenantName: string } | null>(null);
  const [showForm, setShowForm] = useState(false);

  const {
    isXeroAuthenticated,
    getXeroTenantInfo,
    connectToXero,
    exportReceiptsToXero
  } = useReceiptManager();

  // Check Xero connection status when dialog opens
  useEffect(() => {
    if (isOpen) {
      const connected = isXeroAuthenticated();
      setIsConnectedToXero(connected);

      if (connected) {
        const tenantInfo = getXeroTenantInfo();
        setXeroTenantInfo(tenantInfo);
        setShowForm(true);
      } else {
        setShowForm(false);
        setXeroTenantInfo(null);
      }
    }
  }, [isOpen, isXeroAuthenticated, getXeroTenantInfo]);

  const handleConnectToXero = async () => {
    setIsConnecting(true);
    try {
      await connectToXero();
      // Page will redirect to Xero, then back to complete export
    } catch (error) {
      console.error('Failed to connect to Xero:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      if (isConnectedToXero) {
        // Use enhanced Xero export with AI matching
        await exportReceiptsToXero();
        onClose();
      } else {
        // Fallback to basic export if not connected
        const exportConfig = validateXeroExportData(receipts);
        const csvContent = generateXeroCSV(receipts, exportConfig);
        onExport(csvContent);
        onClose();
      }
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
          <DialogTitle>
            {isConnectedToXero ? 'Export to Xero with AI Matching' : 'Connect to Xero'}
          </DialogTitle>
          <DialogDescription>
            {isConnectedToXero
              ? `AI will automatically match your ${receipts.length} receipts to the most appropriate Xero account codes.`
              : 'Connect your Xero account to enable intelligent account code matching and automatic data extraction.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {!isConnectedToXero ? (
            // Not connected to Xero - show connection prompt
            <div className="text-center space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-blue-900 mb-2">
                  🚀 Unlock AI-Powered Export
                </h3>
                <ul className="text-sm text-blue-800 text-left space-y-1">
                  <li>• AI automatically matches receipt categories to Xero account codes</li>
                  <li>• Smart extraction of invoice numbers, emails, and addresses</li>
                  <li>• No manual account code entry required</li>
                  <li>• Higher accuracy and faster processing</li>
                </ul>
              </div>

              <Button
                onClick={handleConnectToXero}
                disabled={isConnecting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                size="lg"
              >
                {isConnecting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Connecting to Xero...
                  </>
                ) : (
                  <>
                    🔗 Connect Xero Account
                  </>
                )}
              </Button>

              <div className="text-center">
                <button
                  onClick={() => setShowForm(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Continue with manual export instead
                </button>
              </div>
            </div>
          ) : (
            // Connected to Xero - show export options
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-green-800 font-medium">
                    Connected to {xeroTenantInfo?.tenantName || 'Xero'}
                  </span>
                </div>
                <p className="text-sm text-green-700 mt-2">
                  AI account matching and enhanced data extraction are active.
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Export Summary</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Total receipts:</span>
                    <span className="font-medium">{receipts.length}</span>
                  </div>
                  {missingCount > 0 && (
                    <div className="flex justify-between">
                      <span>Need completion:</span>
                      <span className="font-medium text-orange-600">{missingCount}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {isConnectedToXero && (
            <div className="flex items-center justify-center space-x-4 pt-4 border-t">
              <Button variant="outline" onClick={onClose} disabled={isExporting}>
                Cancel
              </Button>
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isExporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing with AI...
                  </>
                ) : (
                  <>
                    🤖 Export with AI Matching
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

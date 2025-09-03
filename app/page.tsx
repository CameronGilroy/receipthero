"use client";

import type React from "react";
import { useState, useEffect } from "react";
import {
  type ProcessedReceipt,
  type SpendingBreakdown,
} from "@/lib/types";
import { useReceiptStorage } from "@/lib/useLocalStorage";

import UploadReceiptPage from "@/app/components/UploadReceiptPage";
import ResultsPage from "@/app/components/ResultsPage";

export default function HomePage() {
  const {
    processedReceipts,
    spendingBreakdown,
    base64s,
    isLoaded,
    updateReceipts,
    clearStorage
  } = useReceiptStorage();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Show results if data was loaded from localStorage
  useEffect(() => {
    if (isLoaded && processedReceipts.length > 0 && spendingBreakdown) {
      setShowResults(true);
    }
  }, [isLoaded, processedReceipts.length, spendingBreakdown]);

  const recalculateBreakdown = (receipts: ProcessedReceipt[]): SpendingBreakdown => {
    const categoryTotals = receipts.reduce((acc, receipt) => {
      acc[receipt.category] = (acc[receipt.category] || 0) + receipt.amount;
      return acc;
    }, {} as Record<string, number>);

    const totalSpending = receipts.reduce(
      (sum, receipt) => sum + receipt.amount,
      0
    );

    const categories = Object.entries(categoryTotals)
      .map(([name, amount]) => ({
        name,
        amount: Math.round(amount * 100) / 100,
        percentage: Math.round((amount / totalSpending) * 100),
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalSpending: Math.round(totalSpending * 100) / 100,
      totalReceipts: receipts.length,
      categories,
    };
  };

  const handleProcessFiles = async (files: File[], receipts: ProcessedReceipt[], base64s: string[]) => {
    setIsProcessing(true);

    try {
      console.log('OCR receipts:', receipts);

      // Use real receipts from OCR, but add missing fields
      const enrichedReceipts = receipts.map((receipt, index) => ({
        ...receipt,
        id: receipt.id || Math.random().toString(36).substring(2, 11),
        fileName: receipt.fileName || files[index]?.name || 'unknown',
        thumbnail: receipt.thumbnail || `data:image/jpeg;base64,${base64s[index]}`,
      }));

      const breakdown = recalculateBreakdown(enrichedReceipts);

      updateReceipts(enrichedReceipts, breakdown, base64s);
      setShowResults(true);
    } catch (error) {
      console.error("Processing failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddMoreReceipts = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*";

    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      setIsProcessing(true);

      try {
        // Process files using real OCR API
        const fileArray = Array.from(files);
        const newReceipts: ProcessedReceipt[] = [];
        const newBase64s: string[] = [];

        for (const file of fileArray) {
          try {
            // Convert file to base64
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as string;
                const base64Data = result.split(',')[1];
                resolve(base64Data);
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });

            newBase64s.push(base64);

            // Call OCR API
            const response = await fetch('/api/ocr', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ base64Image: base64 }),
            });

            const data = await response.json();

            if (response.ok && data.receipts) {
              // Enrich receipts with additional fields
              const enrichedReceipts = data.receipts.map((receipt: ProcessedReceipt) => ({
                ...receipt,
                id: receipt.id || Math.random().toString(36).substring(2, 11),
                fileName: receipt.fileName || file.name,
                thumbnail: receipt.thumbnail || `data:image/jpeg;base64,${base64}`,
              }));
              newReceipts.push(...enrichedReceipts);
            }
          } catch (error) {
            console.error('Error processing file:', error);
          }
        }

        const updatedReceipts = [...processedReceipts, ...newReceipts];
        const updatedBase64s = [...base64s, ...newBase64s];

        updateReceipts(updatedReceipts, recalculateBreakdown(updatedReceipts), updatedBase64s);
      } catch (error) {
        console.error("Processing failed:", error);
      } finally {
        setIsProcessing(false);
      }
    };

    input.click();
  };

  const handleDeleteReceipt = (receiptId: string) => {
    const updatedReceipts = processedReceipts.filter(
      (receipt) => receipt.id !== receiptId
    );

    if (updatedReceipts.length === 0) {
      updateReceipts([], null, []);
      setShowResults(false);
    } else {
      updateReceipts(updatedReceipts, recalculateBreakdown(updatedReceipts), base64s);
    }
  };

  const handleStartOver = () => {
    clearStorage();
    setShowResults(false);
  };

  if (showResults && spendingBreakdown) {
    return (
      <ResultsPage
        processedReceipts={processedReceipts}
        spendingBreakdown={spendingBreakdown}
        onAddMoreReceipts={handleAddMoreReceipts}
        onDeleteReceipt={handleDeleteReceipt}
        onStartOver={handleStartOver}
        isProcessing={isProcessing}
      />
    );
  }

  return (
    <UploadReceiptPage
      onProcessFiles={handleProcessFiles}
      isProcessing={isProcessing}
    />
  );
}
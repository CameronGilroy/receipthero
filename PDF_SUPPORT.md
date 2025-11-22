# PDF Upload Support

## Overview
Added support for uploading PDF files in addition to images. PDF files are converted to images (one per page) and then processed through the existing OCR pipeline.

## Changes Made

### 1. Dependencies
- **Added**: `pdfjs-dist` - Mozilla's PDF.js library for rendering PDF pages as images

### 2. File Upload Configuration
Updated accept types to include PDF files:

**components/UploadReceiptPage.tsx**
- Added `"application/pdf": []` to the dropzone accept configuration

**lib/useReceiptManager.ts**
- Updated `selectFiles()` to accept `'image/*,application/pdf'`

### 3. PDF Processing Logic
Added PDF to image conversion in `lib/useReceiptManager.ts`:

- **convertPdfToImages()**: Converts each PDF page to a JPEG image
  - Uses PDF.js to render each page at 2x scale for better OCR quality
  - Returns array of base64-encoded JPEG images

- **processFiles()**: Enhanced to handle PDFs
  - Detects PDF files by mime type
  - Converts each page to an image
  - Processes multi-page PDFs as separate receipts
  - Names pages as "filename.pdf (page 1)", "filename.pdf (page 2)", etc.
  - Falls back gracefully on PDF conversion errors

## Usage
Users can now:
1. Drag and drop PDF files into the upload area
2. Use the file selector to choose PDF files
3. Upload multi-page PDFs (each page processed as a separate receipt)
4. Mix PDF and image uploads in the same batch

## Technical Details
- PDF pages are rendered as JPEG images at 2x scale (scale: 2.0)
- Each page is converted to base64 and processed through the existing OCR API
- PDF conversion happens in the browser using canvas rendering
- Multi-page PDFs automatically generate multiple receipt entries
- Error handling preserves original error messages for troubleshooting

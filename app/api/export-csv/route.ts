import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ProcessedReceiptSchema } from '@/lib/types';
import { generateXeroCSV, validateXeroExportData } from '@/lib/csvExport';

const exportRequestSchema = z.object({
  receipts: z.array(ProcessedReceiptSchema),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate request body
    const validated = exportRequestSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validated.error.message },
        { status: 400 }
      );
    }

    const { receipts } = validated.data;

    if (receipts.length === 0) {
      return NextResponse.json(
        { error: 'No receipts provided' },
        { status: 400 }
      );
    }

    // Validate export data
    const exportConfig = validateXeroExportData(receipts);
    if (!exportConfig.exportReady) {
      return NextResponse.json(
        {
          error: 'Export data validation failed',
          missingData: exportConfig.missingData
        },
        { status: 422 }
      );
    }

    // Generate CSV content
    const csvContent = generateXeroCSV(receipts, exportConfig);

    // Return CSV as downloadable file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="receipts-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });

  } catch (error) {
    console.error('/api/export-csv error', error);
    return NextResponse.json(
      { error: 'Internal error while generating CSV' },
      { status: 500 }
    );
  }
}

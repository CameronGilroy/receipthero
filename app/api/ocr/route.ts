import { NextResponse } from 'next/server';
import { openrouterClient } from '@/lib/client';
import { z } from 'zod';
import { ProcessedReceiptSchema } from '@/lib/types';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const dailyLimit = parseInt(process.env.DAILY_RECEIPT_LIMIT || '30', 10);

// Only create ratelimit if Redis is configured
let ratelimit: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(dailyLimit, '1 d'),
    analytics: true,
  });
}

export async function POST(request: Request) {
  try {
    const { base64Image } = await request.json();

    if (!base64Image || typeof base64Image !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: base64Image' },
        { status: 400 }
      );
    }

    // Rate limiting: configurable receipts per day per IP (only if Redis is configured)
    if (ratelimit) {
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0] ||
        request.headers.get('x-real-ip') ||
        'unknown';
      const { success } = await ratelimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            details:
              `You've reached the daily limit of ${dailyLimit} receipts. Contact @nutlope on X/Twitter for higher limits.`,
          },
          { status: 429 }
        );
      }
    }

    const receiptSchema = z.object({
      receipts: z.array(ProcessedReceiptSchema),
    });
    const jsonSchema = z.toJSONSchema(receiptSchema);

    const response = await openrouterClient.chat.send({
      model: 'meta-llama/llama-3.2-90b-vision-instruct',
      stream: false,
      messages: [
        {
          role: 'system',
          content: `You are an expert at extracting receipt data. Extract all receipts from the image as a JSON object matching the schema.

CRITICAL FORMATTING REQUIREMENTS:
- Date MUST be in YYYY-MM-DD format (e.g., "2024-01-15", not "01/15/2024" or "Jan 15, 2024")
- Convert any date format to YYYY-MM-DD
- If date is ambiguous, use the most recent logical date

REQUIRED JSON STRUCTURE:
{
  "receipts": [
    {
      "id": "string (generate unique ID)",
      "fileName": "string (use 'receipt' as default)",
      "date": "string (YYYY-MM-DD format)",
      "vendor": "string (store/business name)",
      "category": "string (see categorization rules below)",
      "paymentMethod": "string (cash/credit/debit/etc)",
      "taxAmount": "number (tax amount as decimal)",
      "amount": "number (total amount as decimal)",
      "currency": "string (3-letter currency code)",
      "thumbnail": "string (empty string)",
      "base64": "string (empty string)",
      "mimeType": "string (image/jpeg or image/png)",
      "invoiceNumber": "string (optional invoice/receipt number)",
      "contactEmail": "string (optional email address if visible)",
      "dueDate": "string (optional due date in YYYY-MM-DD format)",
      "inventoryItemCode": "string (optional item/service code)",
      "description": "string (optional detailed item description)",
      "quantity": "number (optional quantity, default 1)",
      "unitAmount": "number (optional per-unit amount)",
      "accountCode": "string (optional accounting code)",
      "taxType": "string (optional tax rate/type like 'GST', 'VAT 20%', etc)",
      "poAddressLine1": "string (optional purchase order address line 1)",
      "poAddressLine2": "string (optional purchase order address line 2)",
      "poCity": "string (optional city for PO address)",
      "poRegion": "string (optional state/region for PO address)",
      "poPostalCode": "string (optional postal code for PO address)",
      "poCountry": "string (optional country for PO address)"
    }
  ]
}

CURRENCY EXTRACTION:
- ALWAYS include a currency field in the response
- Extract the currency code (e.g., "USD", "EUR", "AED", "GBP", "CAD", etc.) from currency symbols or explicit mentions
- Common currency symbols: $ = USD, € = EUR, £ = GBP, AED = AED (or د.إ), etc.
- If no currency symbol is visible on the receipt, use "USD" as the default
- Currency field should be the 3-letter currency code (ISO 4217 format)

CATEGORIZATION RULES:
- Grocery stores (Walmart, Target, Kroger, Safeway, Whole Foods, Trader Joe's, Costco, Sam's Club, Aldi, Publix, Wegmans): "groceries"
- Restaurants/Fast food (McDonald's, Starbucks, Chipotle, Taco Bell, Subway, etc.): "dining"
- Gas stations (Shell, Exxon, Chevron, BP, Speedway, etc.): "gas"
- Pharmacies (CVS, Walgreens, Rite Aid, etc.): "healthcare"
- Department stores (Macy's, Kohl's, JCPenney, etc.): "shopping"
- Electronics (Best Buy, Apple Store, etc.): "electronics"
- Home improvement (Home Depot, Lowe's, etc.): "home"
- Clothing (Gap, Old Navy, H&M, etc.): "clothing"
- Online services (Amazon, eBay, etc.): "shopping"
- Utilities (electric, gas, water, internet): "utilities"
- Entertainment (movies, concerts, etc.): "entertainment"
- Travel (hotels, airlines, etc.): "travel"
- Other: Use your best judgment to categorize appropriately

PAYMENT METHODS: Common values include "cash", "credit", "debit", "check", "gift card", "digital wallet"

Extract all visible receipt data accurately. If information is not visible or cannot be determined confidently, omit the field entirely (do not use default values for optional fields). Respond only with valid JSON matching the exact structure above.

ADDITIONAL CSV EXPORT FIELDS TO EXTRACT:
- Invoice numbers, order numbers, or receipt reference numbers
- Email addresses for the vendor or customer
- Due dates, payment terms, or expiration dates
- Item codes, SKU numbers, or product identifiers
- Detailed item descriptions beyond just vendor names
- Quantities for line items (if multiple items)
- Unit prices or individual item costs
- Account codes or department codes
- Tax type information (GST, VAT, Sales Tax, etc.)
- Business addresses, billing addresses, or shipping addresses
- Look for terms like "Invoice #", "Order #", "Ref:", "PO:", "Due:", "Terms:", etc.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract receipt data from this image following the formatting and categorization rules. Look carefully for additional accounting and billing information that would be useful for CSV export to tools like Xero.',
            },
            {
              type: 'image_url',
              imageUrl: { url: `data:image/jpeg;base64,${base64Image}` },
            },
          ],
        },
      ],
      responseFormat: { type: 'json_object' },
    });

    const content = response?.choices?.[0]?.message?.content;

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'OCR extraction failed: empty or invalid response' },
        { status: 502 }
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content);
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid JSON from model' },
        { status: 502 }
      );
    }

    const validated = receiptSchema.safeParse(parsedJson);
    if (!validated.success) {
      console.error('OCR validation failed:', validated.error.message);
      console.error('Raw response:', parsedJson);
      return NextResponse.json(
        { error: 'Validation failed', details: validated.error.message },
        { status: 422 }
      );
    }

    return NextResponse.json({ receipts: validated.data.receipts });
  } catch (error) {
    console.error('/api/ocr error', error);
    return NextResponse.json(
      { error: 'Internal error while performing OCR' },
      { status: 500 }
    );
  }
}

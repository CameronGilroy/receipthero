<a href="https://www.receipthero.app">
  <img alt="ReceiptHero" src="./public/og.png">
  <h1 align="center">ReceiptHero</h1>
</a>

<p align="center">
  An open source receipt management app with AI-powered OCR. Powered by OpenRouter.
</p>

## Tech stack

- Next.js app router with Tailwind CSS
- OpenRouter for LLM-powered OCR
- Llama 3.2 90B Vision for receipt data extraction
- PDF.js for PDF rendering and conversion
- shadcn/ui components with Radix UI
- Zod for data validation

## How it works

1. Upload receipt images or PDFs via drag & drop or file selection
2. PDFs are automatically converted to images (first page only)
3. Send images to OpenRouter's Llama 3.2 90B Vision model for OCR processing
4. Extract structured data: vendor, date, amount, items, currency, payment method
5. Automatically categorize expenses (groceries, dining, gas, etc.)
6. Display spending breakdown and receipt management interface
7. Store data locally in browser for privacy

## Cloning & running

1. Fork or clone the repo
2. Create an account at [OpenRouter](https://openrouter.ai/) for the OCR API
3. Create a `.env` file (use `.example.env` for reference) and add your API key
4. Run `npm install` and `npm run dev` to install dependencies and run locally

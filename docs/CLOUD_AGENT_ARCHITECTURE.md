# Cloud Agent Architecture

## Overview

ReceiptHero uses a **Cloud Agent Pattern** for AI-powered OCR processing. This architecture delegates complex AI tasks to cloud-based services, providing scalability, security, and maintainability.

## Architecture Diagram

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │ Upload receipt images
       │
       ▼
┌─────────────────────┐
│  Cloud Agent API    │
│  (/api/ocr)         │
│                     │
│  • Rate limiting    │
│  • Validation       │
│  • Error handling   │
└──────┬──────────────┘
       │ Delegate to AI
       │
       ▼
┌─────────────────────┐
│  Together AI        │
│  (Llama 4 Scout)    │
│                     │
│  • OCR processing   │
│  • Data extraction  │
│  • Categorization   │
└──────┬──────────────┘
       │ Return results
       │
       ▼
┌─────────────────────┐
│  Client Processing  │
│                     │
│  • Currency conv.   │
│  • Storage          │
│  • UI updates       │
└─────────────────────┘
```

## Key Components

### 1. Client-Side Abstraction (`lib/cloud-agent.ts`)

The `delegateToCloudAgent()` function provides a clean interface for delegating OCR processing:

```typescript
const data = await delegateToCloudAgent(base64Image);
```

**Benefits:**
- Single point of interaction with the cloud agent
- Consistent error handling
- Easy to swap AI providers if needed

### 2. API Route (`app/api/ocr/route.ts`)

The server-side endpoint handles:
- **Rate Limiting**: 30 receipts per day per IP via Upstash Redis
- **Request Validation**: Ensures proper image format
- **Schema Validation**: Validates AI responses against Zod schemas
- **Error Handling**: Graceful degradation on failures

### 3. AI Provider Integration (`lib/client.ts`)

Together AI client configuration with optional Helicone monitoring for:
- Usage tracking
- Performance monitoring
- Cost analysis

## Benefits of Cloud Agent Pattern

### Scalability
- No client-side ML model downloads
- Server handles computational load
- Horizontal scaling capability

### Security
- API keys never exposed to client
- Server-side rate limiting
- Request validation and sanitization

### Maintainability
- Centralized AI logic
- Easy provider switching
- Consistent error handling

### Performance
- Parallel processing of multiple receipts
- Optimized AI model selection
- Efficient image handling

## Rate Limiting

The cloud agent implements rate limiting to prevent abuse:
- **Limit**: 30 receipts per day per IP
- **Storage**: Upstash Redis for distributed rate limiting
- **Response**: HTTP 429 with clear error message

## Error Handling

The cloud agent handles various error scenarios:

| Error Type | Status Code | Handling |
|------------|-------------|----------|
| Missing image | 400 | Validation error |
| Rate limit exceeded | 429 | Toast notification with details |
| AI processing failure | 502 | Graceful error with retry option |
| Validation failure | 422 | Schema validation error |
| Internal error | 500 | Generic error handling |

## Usage Example

```typescript
import { delegateToCloudAgent } from '@/lib/cloud-agent';

try {
  const response = await delegateToCloudAgent(base64Image);
  
  if (response.receipts.length > 0) {
    // Process receipts
    console.log('Extracted receipts:', response.receipts);
  }
} catch (error) {
  if (isRateLimitError(error)) {
    // Handle rate limiting
    showRateLimitMessage();
  } else {
    // Handle other errors
    showErrorMessage(error);
  }
}
```

## Configuration

Required environment variables:

```env
# Together AI API key (required)
TOGETHER_API_KEY=your_api_key

# Upstash Redis for rate limiting (required)
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# Helicone for monitoring (optional)
HELICONE_API_KEY=your_helicone_key
```

## AI Model Details

**Model**: `meta-llama/Llama-4-Scout-17B-16E-Instruct`

**Capabilities:**
- Multi-modal input (text + images)
- Structured JSON output
- High accuracy OCR
- Category recognition
- Multi-currency support

**Extraction Features:**
- Vendor name
- Date (normalized to YYYY-MM-DD)
- Total amount
- Tax amount
- Currency (with symbol recognition)
- Payment method
- Line items
- Automatic categorization

## Future Enhancements

Potential improvements to the cloud agent pattern:

1. **Multiple AI Providers**: Fallback to alternative providers
2. **Caching**: Cache results for identical images
3. **Batch Processing**: Group multiple receipts in single request
4. **Webhooks**: Async processing for large batches
5. **Local Fallback**: Client-side OCR for offline mode

## Monitoring

Use Helicone for cloud agent monitoring:
- Request/response logging
- Latency tracking
- Cost per request
- Error rate monitoring
- Usage analytics

## Best Practices

1. **Always validate input** before delegating to cloud agent
2. **Handle rate limits gracefully** with user-friendly messages
3. **Implement retry logic** for transient failures
4. **Monitor cloud agent performance** via Helicone
5. **Keep abstractions clean** for easy provider switching
6. **Test error scenarios** thoroughly
7. **Document API contracts** clearly

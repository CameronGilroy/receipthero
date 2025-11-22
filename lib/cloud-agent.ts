/**
 * Cloud Agent Abstraction
 * 
 * This module provides an abstraction for delegating OCR processing
 * to cloud-based AI agents (currently Together AI with Llama 4 Scout).
 * 
 * The cloud agent pattern allows for:
 * - Scalable OCR processing without client-side ML models
 * - Centralized rate limiting and monitoring
 * - Easy swapping of AI providers
 */

import { ProcessedReceipt } from './types';

export interface CloudAgentResponse {
  receipts: ProcessedReceipt[];
}

export interface CloudAgentError {
  error: string;
  details?: string;
}

/**
 * Delegates receipt OCR processing to the cloud agent
 * 
 * @param base64Image - Base64 encoded image data
 * @returns Processed receipt data from the cloud agent
 * @throws Error if cloud agent processing fails
 */
export async function delegateToCloudAgent(
  base64Image: string
): Promise<CloudAgentResponse> {
  const response = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Image }),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data as CloudAgentError;
    throw new Error(error.details || error.error || 'Cloud agent processing failed');
  }

  return data as CloudAgentResponse;
}

/**
 * Check if an error is a rate limit error from the cloud agent
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('Rate limit') || error.message.includes('429');
  }
  return false;
}

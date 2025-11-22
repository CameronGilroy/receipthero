import { OpenRouter } from '@openrouter/sdk';

// Create OpenRouter client using the official SDK
const createOpenRouterClient = () => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is required');
  }

  return new OpenRouter({
    apiKey: apiKey,
  });
};

export const openrouterClient = createOpenRouterClient();

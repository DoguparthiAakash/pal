import { LLMProvider } from '@/domain/interfaces';
import { config } from '@/config';

// Free models available on OpenRouter (no credits needed)
const FREE_MODELS = [
  'qwen/qwen3-8b:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
];

export class OpenRouterLLMProvider implements LLMProvider {
  private apiKey: string;
  private defaultModel = FREE_MODELS[0];
  private baseUrl = 'https://openrouter.ai/api/v1/chat/completions';

  constructor() {
    if (!config.providers.llm.openrouterApiKey) {
      console.warn('OPENROUTER_API_KEY is not set. OpenRouterLLMProvider will fail if invoked.');
    }
    this.apiKey = config.providers.llm.openrouterApiKey || '';
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'HTTP-Referer': 'https://pal.app',
      'X-Title': 'PAL - Personal AI Lab',
    };
  }

  async generateText(
    systemPrompt: string,
    messages: { role: string; content: string }[],
    options?: any
  ): Promise<string> {
    const model = options?.model || this.defaultModel;
    
    // Try models in order with automatic fallback
    const modelsToTry = [model, ...FREE_MODELS.filter(m => m !== model)];
    
    for (const tryModel of modelsToTry) {
      try {
        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            model: tryModel,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages,
            ],
            temperature: options?.temperature ?? 0.7,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.warn(`OpenRouter model ${tryModel} failed: ${error} — trying next model`);
          continue;
        }

        const data = await response.json();
        return data.choices[0].message.content;
      } catch (err) {
        console.warn(`OpenRouter model ${tryModel} threw error — trying next model`, err);
        continue;
      }
    }

    throw new Error('All OpenRouter models failed. Check your API key and quota.');
  }

  async streamText(
    systemPrompt: string,
    messages: { role: string; content: string }[],
    options?: any
  ): Promise<ReadableStream> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: options?.model || this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: options?.temperature ?? 0.7,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const error = await response.text();
      throw new Error(`OpenRouter API Error: ${error}`);
    }

    return response.body;
  }
}

/**
 * Convenience function: generate text via OpenRouter with automatic model fallback.
 * Used by pipelines that don't need the full LLMProvider interface.
 */
export async function generateWithOpenRouter(
  prompt: string,
  apiKey: string,
  model = FREE_MODELS[0]
): Promise<string> {
  const modelsToTry = [model, ...FREE_MODELS.filter(m => m !== model)];
  
  for (const tryModel of modelsToTry) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://pal.app',
          'X-Title': 'PAL',
        },
        body: JSON.stringify({
          model: tryModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
        }),
      });

      if (!response.ok) {
        console.warn(`OpenRouter ${tryModel} failed, trying next...`);
        continue;
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch {
      continue;
    }
  }

  throw new Error('All OpenRouter models failed during artifact generation.');
}

import { LLMProvider } from '@/domain/interfaces';
import { config } from '@/config';

export class GroqLLMProvider implements LLMProvider {
  private apiKey: string;
  private defaultModel = 'llama-3.1-8b-instant';
  private baseUrl = 'https://api.groq.com/openai/v1/chat/completions';

  constructor() {
    if (!config.providers.llm.groqApiKey) {
      console.warn("GROQ_API_KEY is not set. GroqLLMProvider will fail if invoked.");
    }
    this.apiKey = config.providers.llm.groqApiKey || '';
  }

  async generateText(
    systemPrompt: string, 
    messages: { role: string; content: string }[], 
    options?: any
  ): Promise<string> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options?.model || this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: options?.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API Error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async streamText(
    systemPrompt: string, 
    messages: { role: string; content: string }[], 
    options?: any
  ): Promise<ReadableStream> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
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
      throw new Error(`Groq API Error: ${error}`);
    }

    return response.body;
  }
}

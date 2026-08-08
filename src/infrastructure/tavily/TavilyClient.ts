import { config } from '@/config';

export class TavilyClient {
  async search(query: string, maxResults: number = 3) {
    const apiKey = config.providers.llm.tavilyApiKey || process.env.TAVILY_API_KEY;
    
    if (!apiKey) {
      console.warn('Tavily API key not found. Skipping external search.');
      return [];
    }

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: query,
          search_depth: 'basic',
          include_answer: false,
          include_images: false,
          include_raw_content: false,
          max_results: maxResults,
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavily search failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Tavily Search Error:', error);
      return [];
    }
  }
}

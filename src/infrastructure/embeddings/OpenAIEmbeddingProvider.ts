import { EmbeddingProvider } from '@/domain/interfaces';
import { embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { config } from '@/config';

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private dimension: number = 1536;
  
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const openai = createOpenAI({ apiKey: config.providers.embedding.openaiApiKey || '' });
    
    const { embeddings } = await embedMany({
      model: openai.embedding('text-embedding-3-small'),
      values: texts,
    });
    
    return embeddings;
  }

  getEmbeddingDimension(): number {
    return this.dimension;
  }
}

import { EmbeddingProvider } from '@/domain/interfaces';
import { config } from '@/config';
import { OpenAIEmbeddingProvider } from './OpenAIEmbeddingProvider';
import { LocalEmbeddingProvider } from './LocalEmbeddingProvider';

export class EmbeddingProviderFactory {
  static create(): EmbeddingProvider {
    if (config.providers.embedding.provider === 'openai' && config.providers.embedding.openaiApiKey) {
      return new OpenAIEmbeddingProvider();
    }
    // Fall back to our free Local Embedding model (Transformers.js)
    return new LocalEmbeddingProvider();
  }
}

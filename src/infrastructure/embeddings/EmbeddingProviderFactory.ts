import { EmbeddingProvider } from '@/domain/interfaces';
import { config } from '@/config';
import { OpenAIEmbeddingProvider } from './OpenAIEmbeddingProvider';
import { HuggingFaceEmbeddingProvider } from './HuggingFaceEmbeddingProvider';
import { LocalEmbeddingProvider } from './LocalEmbeddingProvider';

export class EmbeddingProviderFactory {
  static create(): EmbeddingProvider {
    if (config.providers.embedding.provider === 'openai' && config.providers.embedding.openaiApiKey) {
      return new OpenAIEmbeddingProvider();
    }
    
    if (config.providers.embedding.provider === 'huggingface' || config.providers.embedding.huggingFaceToken) {
      return new HuggingFaceEmbeddingProvider();
    }
    
    // Fall back to our free Local Embedding model (Transformers.js) if explicitly configured or as a last resort
    return new LocalEmbeddingProvider();
  }
}

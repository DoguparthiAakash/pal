import { EmbeddingProvider } from '@/domain/interfaces';
import { config } from '@/config';
import { MockEmbeddingProvider } from './MockEmbeddingProvider';
import { OpenAIEmbeddingProvider } from './OpenAIEmbeddingProvider';

export class EmbeddingProviderFactory {
  static create(): EmbeddingProvider {
    if (config.providers.embedding.provider === 'openai') {
      return new OpenAIEmbeddingProvider();
    }
    return new MockEmbeddingProvider();
  }
}

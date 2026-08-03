import { VectorStore, EmbeddingProvider } from '@/domain/interfaces';
import { Chunk, KnowledgeBase } from '@/domain/entities';
import { ObservabilityService } from './ObservabilityService';

export class RetrievalService {
  constructor(
    private vectorStore: VectorStore,
    private embeddingProvider: EmbeddingProvider,
    private observer: ObservabilityService
  ) {}

  async retrieveContext(
    query: string,
    userId: string,
    kb: KnowledgeBase
  ): Promise<Chunk[]> {
    return await this.observer.traceAsync('retrieval', userId, async () => {
      // 1. Embed query
      const [queryEmbedding] = await this.embeddingProvider.generateEmbeddings([query]);

      // 2. Search isolated vector store
      const chunks = await this.vectorStore.searchChunks(
        queryEmbedding,
        kb.settings.top_k,
        userId,
        kb.id,
        kb.settings.similarity_threshold
      );

      return chunks;
    }, { queryLength: query.length });
  }
}

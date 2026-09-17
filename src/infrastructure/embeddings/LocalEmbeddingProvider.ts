import { EmbeddingProvider } from '@/domain/interfaces';
import path from 'path';
import os from 'os';
import { SupabaseCacheService } from '@/infrastructure/cache/SupabaseCacheService';

export class LocalEmbeddingProvider implements EmbeddingProvider {
  private dimension: number = 384;
  private static extractorPromise: Promise<any> | null = null;

  private async getExtractor() {
    if (!LocalEmbeddingProvider.extractorPromise) {
      LocalEmbeddingProvider.extractorPromise = (async () => {
        const { env, pipeline } = await import('@xenova/transformers');
        
        // Optimization for serverless environments
        env.allowLocalModels = false;
        env.useBrowserCache = false;
        env.cacheDir = path.join(os.tmpdir(), '.cache');

        return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
          quantized: true,
        });
      })();
    }
    return LocalEmbeddingProvider.extractorPromise;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {

    // ── Cache-first: resolve as many texts as possible from embedding_cache ──
    const results: (number[] | null)[] = new Array(texts.length).fill(null);
    const uncachedIndices: number[] = [];

    await Promise.all(texts.map(async (text, i) => {
      try {
        const cached = await SupabaseCacheService.getCachedEmbedding(text);
        if (cached) {
          results[i] = cached;
        } else {
          uncachedIndices.push(i);
        }
      } catch {
        uncachedIndices.push(i);
      }
    }));

    // ── Run ONNX model only on uncached texts ─────────────────────────────
    if (uncachedIndices.length > 0) {
      const uncachedTexts = uncachedIndices.map(i => texts[i]);
      const extractor = await this.getExtractor();
      const batchSize = 15; // Process 15 chunks at a time to prevent Vercel Serverless OOM crashes

      const freshEmbeddings: number[][] = [];

      for (let i = 0; i < uncachedTexts.length; i += batchSize) {
        const batch = uncachedTexts.slice(i, i + batchSize);
        const output = await extractor(batch, { pooling: 'mean', normalize: true });
        const list = output.tolist();

        if (batch.length === 1 && list.length === this.dimension && typeof list[0] === 'number') {
          freshEmbeddings.push(list as unknown as number[]);
        } else {
          freshEmbeddings.push(...(list as unknown as number[][]));
        }
      }

      // Write fresh embeddings to cache (fire-and-forget) and fill results
      freshEmbeddings.forEach((embedding, idx) => {
        const originalIndex = uncachedIndices[idx];
        results[originalIndex] = embedding;
        const text = texts[originalIndex];
        SupabaseCacheService.setCachedEmbedding(text, embedding).catch(() => {});
      });
    }

    return results as number[][];
  }

  getEmbeddingDimension(): number {
    return this.dimension;
  }
}

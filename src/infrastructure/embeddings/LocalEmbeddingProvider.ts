import { EmbeddingProvider } from '@/domain/interfaces';
import { env, pipeline } from '@xenova/transformers';
import path from 'path';
import os from 'os';
import { SupabaseCacheService } from '@/infrastructure/cache/SupabaseCacheService';

// Optimization for serverless environments
env.allowLocalModels = false; // Force download from HuggingFace Hub
env.useBrowserCache = false;  // No browser cache in Node.js
// Vercel serverless functions have read-only filesystems except for /tmp
env.cacheDir = path.join(os.tmpdir(), '.cache');

export class LocalEmbeddingProvider implements EmbeddingProvider {
  private dimension: number = 384;
  private static extractorPromise: Promise<any> | null = null;

  constructor() {
    // Lazy load the pipeline so we don't block initialization
    if (!LocalEmbeddingProvider.extractorPromise) {
      LocalEmbeddingProvider.extractorPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: true, // Uses less memory and downloads faster
      });
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!LocalEmbeddingProvider.extractorPromise) {
      throw new Error('Pipeline not initialized');
    }

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
      const extractor = await LocalEmbeddingProvider.extractorPromise;
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

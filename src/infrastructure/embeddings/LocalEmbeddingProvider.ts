import { EmbeddingProvider } from '@/domain/interfaces';
import { env, pipeline } from '@xenova/transformers';
import path from 'path';
import os from 'os';

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
    
    const extractor = await LocalEmbeddingProvider.extractorPromise;
    const embeddings: number[][] = [];
    const batchSize = 15; // Process 15 chunks at a time to prevent Vercel Serverless OOM crashes
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      // Extractor returns a tensor
      const output = await extractor(batch, { pooling: 'mean', normalize: true });
      const list = output.tolist();
      
      if (batch.length === 1 && list.length === this.dimension && typeof list[0] === 'number') {
        embeddings.push(list as unknown as number[]);
      } else {
        embeddings.push(...(list as unknown as number[][]));
      }
    }

    return embeddings;
  }

  getEmbeddingDimension(): number {
    return this.dimension;
  }
}

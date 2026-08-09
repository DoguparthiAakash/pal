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
    
    // Extractor returns a tensor
    const output = await extractor(texts, { pooling: 'mean', normalize: true });
    
    const embeddings: number[][] = [];
    
    // If it's a single text, output.tolist() might return a 1D array or 2D array [1, 384]
    // The library handles multiple inputs by returning a 2D array [N, 384]
    const list = output.tolist();
    
    if (texts.length === 1 && list.length === this.dimension && typeof list[0] === 'number') {
      embeddings.push(list as unknown as number[]);
    } else {
      embeddings.push(...(list as unknown as number[][]));
    }

    return embeddings;
  }

  getEmbeddingDimension(): number {
    return this.dimension;
  }
}

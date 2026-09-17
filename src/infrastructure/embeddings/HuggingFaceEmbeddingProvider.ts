import { EmbeddingProvider } from '@/domain/interfaces';
import { SupabaseCacheService } from '@/infrastructure/cache/SupabaseCacheService';
import { config } from '@/config';

export class HuggingFaceEmbeddingProvider implements EmbeddingProvider {
  private dimension: number = 384; // all-MiniLM-L6-v2 outputs 384d
  private hfToken: string;
  private modelUrl: string = 'https://api-inference.huggingface.co/pipeline/feature-extraction/Xenova/all-MiniLM-L6-v2';

  constructor() {
    this.hfToken = config.providers.embedding.huggingFaceToken || '';
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

    // ── Run HuggingFace API only on uncached texts ─────────────────────────────
    if (uncachedIndices.length > 0) {
      const uncachedTexts = uncachedIndices.map(i => texts[i]);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (this.hfToken) {
        headers['Authorization'] = `Bearer ${this.hfToken}`;
      }
      
      try {
        const response = await fetch(this.modelUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ inputs: uncachedTexts }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HuggingFace API Error (${response.status}): ${errorText}`);
        }

        const freshEmbeddings = await response.json();
        
        // HF API returns arrays of arrays
        if (!Array.isArray(freshEmbeddings)) {
          throw new Error('Unexpected response format from HuggingFace');
        }

        // Write fresh embeddings to cache (fire-and-forget) and fill results
        freshEmbeddings.forEach((embedding: number[], idx: number) => {
          const originalIndex = uncachedIndices[idx];
          results[originalIndex] = embedding;
          const text = texts[originalIndex];
          SupabaseCacheService.setCachedEmbedding(text, embedding).catch(() => {});
        });
      } catch (error) {
        console.error('Error generating embeddings via HuggingFace:', error);
        throw error;
      }
    }

    return results as number[][];
  }

  getEmbeddingDimension(): number {
    return this.dimension;
  }
}

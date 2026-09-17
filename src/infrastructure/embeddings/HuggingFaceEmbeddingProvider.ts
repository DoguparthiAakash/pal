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
      
      const batchSize = 10;
      const allFreshEmbeddings: number[][] = [];

      try {
        for (let i = 0; i < uncachedTexts.length; i += batchSize) {
          const batchTexts = uncachedTexts.slice(i, i + batchSize);
          
          const response = await fetch(this.modelUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ inputs: batchTexts }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HuggingFace API Error (${response.status}): ${errorText}`);
          }

          const batchEmbeddings = await response.json();
          
          // HF API returns arrays of arrays
          if (!Array.isArray(batchEmbeddings)) {
            throw new Error('Unexpected response format from HuggingFace');
          }
          
          // Sometimes HF returns [batchSize, seqLength, hiddenSize] for feature extraction,
          // but for Xenova models we usually expect [batchSize, hiddenSize] if pooled properly.
          // Let's ensure we flatten or extract the embeddings correctly.
          if (batchTexts.length === 1 && !Array.isArray(batchEmbeddings[0])) {
             // single string returned flat array
             allFreshEmbeddings.push(batchEmbeddings as unknown as number[]);
          } else {
             allFreshEmbeddings.push(...batchEmbeddings);
          }
        }

        // Write fresh embeddings to cache (fire-and-forget) and fill results
        allFreshEmbeddings.forEach((embedding: number[], idx: number) => {
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

import { EmbeddingProvider } from '@/domain/interfaces';

export class MockEmbeddingProvider implements EmbeddingProvider {
  private dimension: number;

  constructor(dimension: number = 1536) {
    this.dimension = dimension;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Generates a mock embedding array of random numbers, exactly like the original fallback
    return texts.map(() => 
      Array(this.dimension).fill(0).map(() => Math.random() * 0.2 - 0.1)
    );
  }

  getEmbeddingDimension(): number {
    return this.dimension;
  }
}

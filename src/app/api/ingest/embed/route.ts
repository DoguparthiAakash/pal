import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/application/services/AuthService';
import { DocumentProcessingPipeline } from '@/application/pipeline/DocumentProcessingPipeline';
import { ObservabilityService } from '@/application/services/ObservabilityService';
import { SupabaseStorageProvider } from '@/infrastructure/storage/SupabaseStorageProvider';
import { SupabaseVectorStore } from '@/infrastructure/vector/SupabaseVectorStore';
import { EmbeddingProviderFactory } from '@/infrastructure/embeddings/EmbeddingProviderFactory';
import { SupabaseDocumentRepository } from '@/infrastructure/repositories/SupabaseDocumentRepository';
import { LocalRateLimiter } from '@/infrastructure/rate-limit/LocalRateLimiter';

export const maxDuration = 60; // Set max duration for Vercel deployment

export async function POST(req: NextRequest) {
  try {
    const authService = new AuthService();
    const rateLimiter = new LocalRateLimiter();

    // 1. Auth check
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Rate limiting check
    if (!rateLimiter.checkLimit(user.id)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // 3. Parse JSON body
    const body = await req.json();
    const { chunks } = body;

    if (!chunks || !Array.isArray(chunks)) {
      return NextResponse.json({ error: 'Missing chunks array' }, { status: 400 });
    }

    const observer = new ObservabilityService();
    const pipeline = new DocumentProcessingPipeline(
      new SupabaseStorageProvider(),
      EmbeddingProviderFactory.create(),
      new SupabaseVectorStore(),
      new SupabaseDocumentRepository(),
      observer
    );

    // 4. Embed chunks
    const embeddings = await pipeline.embed(user, chunks);

    return NextResponse.json({ embeddings });

  } catch (error: any) {
    console.error('Embedding error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error during embedding' },
      { status: 500 }
    );
  }
}

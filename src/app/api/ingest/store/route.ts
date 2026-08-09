import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/application/services/AuthService';
import { DocumentProcessingPipeline } from '@/application/pipeline/DocumentProcessingPipeline';
import { ObservabilityService } from '@/application/services/ObservabilityService';
import { SupabaseStorageProvider } from '@/infrastructure/storage/SupabaseStorageProvider';
import { SupabaseVectorStore } from '@/infrastructure/vector/SupabaseVectorStore';
import { EmbeddingProviderFactory } from '@/infrastructure/embeddings/EmbeddingProviderFactory';
import { SupabaseDocumentRepository } from '@/infrastructure/repositories/SupabaseDocumentRepository';
import { LocalRateLimiter } from '@/infrastructure/rate-limit/LocalRateLimiter';
import { createServerClient } from '@/infrastructure/auth/server';

export const maxDuration = 60;

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
    const { docId, notebookId, chunks, embeddings } = body;

    if (!docId || !notebookId || !chunks || !embeddings || chunks.length !== embeddings.length) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // 4. Fetch knowledge base
    const supabase = await createServerClient();
    const { data: kb } = await supabase
      .from('knowledge_bases')
      .select('*')
      .eq('id', notebookId)
      .single();

    if (!kb) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
    }

    const observer = new ObservabilityService();
    const pipeline = new DocumentProcessingPipeline(
      new SupabaseStorageProvider(),
      EmbeddingProviderFactory.create(),
      new SupabaseVectorStore(),
      new SupabaseDocumentRepository(),
      observer
    );

    // 5. Store in vector database
    const document = await pipeline.store(user, kb, docId, chunks, embeddings);

    return NextResponse.json({ document_id: document.id });

  } catch (error: any) {
    console.error('Store error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error during storage' },
      { status: 500 }
    );
  }
}

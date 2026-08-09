import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/application/services/AuthService';
import { DocumentProcessingPipeline } from '@/application/pipeline/DocumentProcessingPipeline';
import { ObservabilityService } from '@/application/services/ObservabilityService';
import { SupabaseStorageProvider } from '@/infrastructure/storage/SupabaseStorageProvider';
import { SupabaseVectorStore } from '@/infrastructure/vector/SupabaseVectorStore';
import { EmbeddingProviderFactory } from '@/infrastructure/embeddings/EmbeddingProviderFactory';
import { SupabaseDocumentRepository } from '@/infrastructure/repositories/SupabaseDocumentRepository';
import { LocalRateLimiter } from '@/infrastructure/rate-limit/LocalRateLimiter';
import { config } from '@/config';
import { createServerClient } from '@/infrastructure/auth/server';

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
    const { filePath, fileName, mimeType, size, notebookId } = body;

    if (!filePath || !fileName || !notebookId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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

    // 5. Extract chunks
    const result = await pipeline.extract(user, kb, filePath, fileName, mimeType || '', size || 0);

    return NextResponse.json(result); // { docId, chunks }

  } catch (error: any) {
    console.error('Extraction error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error during extraction' },
      { status: 500 }
    );
  }
}

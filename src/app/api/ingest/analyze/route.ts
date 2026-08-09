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
import { config } from '@/config';

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
    const rateLimit = await rateLimiter.checkLimit(`ingest_${user.id}`, config.app.rateLimits.ingest.limit, config.app.rateLimits.ingest.windowSeconds);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // 3. Parse JSON body
    const body = await req.json();
    const { docId, notebookId, chunks } = body;

    if (!docId || !notebookId || !chunks) {
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

    // 5. Generate Artifacts asynchronously (don't await it to prevent blocking if needed, but here we await to ensure completion)
    // Wait, generating artifacts might take long. We can return immediately or await.
    // We'll await to give proper feedback.
    await pipeline.generateArtifacts(user, kb, docId, chunks, supabase);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Analyze error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error during analysis' },
      { status: 500 }
    );
  }
}

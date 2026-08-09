import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60; // Allow max execution time on Vercel

import { AuthService } from '@/application/services/AuthService';
import { DocumentProcessingPipeline } from '@/application/pipeline/DocumentProcessingPipeline';
import { ObservabilityService } from '@/application/services/ObservabilityService';
import { SupabaseStorageProvider } from '@/infrastructure/storage/SupabaseStorageProvider';
import { SupabaseVectorStore } from '@/infrastructure/vector/SupabaseVectorStore';
import { EmbeddingProviderFactory } from '@/infrastructure/embeddings/EmbeddingProviderFactory';
import { SupabaseDocumentRepository } from '@/infrastructure/repositories/SupabaseDocumentRepository';
import { LocalRateLimiter } from '@/infrastructure/rate-limit/LocalRateLimiter';
import { config } from '@/config';

// Initialize dependencies (In a real app with DI, this would be injected or grabbed from a container)
const observer = new ObservabilityService();
const authService = new AuthService();
const rateLimiter = new LocalRateLimiter();

const pipeline = new DocumentProcessingPipeline(
  new SupabaseStorageProvider(),
  EmbeddingProviderFactory.create(),
  new SupabaseVectorStore(),
  new SupabaseDocumentRepository(),
  observer
);

export const maxDuration = 60; // Set max duration for Vercel deployment

export async function POST(req: NextRequest) {
  try {
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
    const { filePath, fileName, mimeType, size, notebookId } = body;
    
    if (!filePath || !fileName) {
      return NextResponse.json({ error: 'Missing file metadata' }, { status: 400 });
    }

    // 4. Get Target Knowledge Base
    let kb;
    if (notebookId) {
      // Validate they own this notebook
      const { createServerClient } = await import('@/infrastructure/auth/server');
      const supabase = await createServerClient();
      const { data: nkb, error: nkbErr } = await supabase
        .from('knowledge_bases')
        .select('*')
        .eq('id', notebookId)
        .eq('user_id', user.id)
        .single();
      if (!nkbErr && nkb) {
        kb = nkb;
      }
    }
    
    if (!kb) {
      kb = await authService.getDefaultKnowledgeBase(user.id);
    }

    if (!kb) {
      return NextResponse.json({ error: 'Knowledge Base not found' }, { status: 400 });
    }

    // 5. Run the pipeline
    const document = await pipeline.process(user, kb, filePath, fileName, mimeType || 'application/octet-stream', size || 0);

    return NextResponse.json({ 
      success: true, 
      document_id: document.id,
      status: document.status 
    }, { status: 200 });

  } catch (error: any) {
    console.error('Ingest API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

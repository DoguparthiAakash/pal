import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/application/services/AuthService';
import { DocumentProcessingPipeline } from '@/application/pipeline/DocumentProcessingPipeline';
import { ObservabilityService } from '@/application/services/ObservabilityService';
import { SupabaseStorageProvider } from '@/infrastructure/storage/SupabaseStorageProvider';
import { MockEmbeddingProvider } from '@/infrastructure/embeddings/MockEmbeddingProvider';
import { SupabaseVectorStore } from '@/infrastructure/vector/SupabaseVectorStore';
import { SupabaseDocumentRepository } from '@/infrastructure/repositories/SupabaseDocumentRepository';
import { LocalRateLimiter } from '@/infrastructure/rate-limit/LocalRateLimiter';
import { config } from '@/config';

// Initialize dependencies (In a real app with DI, this would be injected or grabbed from a container)
const observer = new ObservabilityService();
const authService = new AuthService();
const rateLimiter = new LocalRateLimiter();

const pipeline = new DocumentProcessingPipeline(
  new SupabaseStorageProvider(),
  new MockEmbeddingProvider(),
  new SupabaseVectorStore(),
  new SupabaseDocumentRepository(),
  observer
);

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

    // 3. Get User's default Knowledge Base
    const kb = await authService.getDefaultKnowledgeBase(user.id);
    if (!kb) {
      return NextResponse.json({ error: 'Knowledge Base not found' }, { status: 400 });
    }

    // 4. Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 5. Run the pipeline
    const document = await pipeline.process(file, user, kb);

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

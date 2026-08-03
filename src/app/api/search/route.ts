import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/application/services/AuthService';
import { RetrievalService } from '@/application/services/RetrievalService';
import { ObservabilityService } from '@/application/services/ObservabilityService';
import { MockEmbeddingProvider } from '@/infrastructure/embeddings/MockEmbeddingProvider';
import { SupabaseVectorStore } from '@/infrastructure/vector/SupabaseVectorStore';

const observer = new ObservabilityService();
const authService = new AuthService();

const retrievalService = new RetrievalService(
  new SupabaseVectorStore(),
  new MockEmbeddingProvider(),
  observer
);

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request
    const { query } = await req.json();
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // 3. Get KB
    const kb = await authService.getDefaultKnowledgeBase(user.id);
    if (!kb) {
      return NextResponse.json({ error: 'Knowledge Base not found' }, { status: 400 });
    }

    // 4. Retrieve context
    const chunks = await retrievalService.retrieveContext(query, user.id, kb);

    return NextResponse.json({ chunks }, { status: 200 });
  } catch (error: any) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

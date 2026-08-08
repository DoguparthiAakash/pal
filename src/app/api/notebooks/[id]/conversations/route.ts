import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/application/services/AuthService';
import { SupabaseConversationRepository } from '@/infrastructure/repositories/SupabaseConversationRepository';

const authService = new AuthService();
const conversationRepo = new SupabaseConversationRepository();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const notebookId = resolvedParams.id;
    if (!notebookId) {
      return NextResponse.json({ error: 'Notebook ID is required' }, { status: 400 });
    }

    // A real app should also verify user ownership of the notebook.
    // Assuming Notebook == KnowledgeBase and RLS handles isolation.
    const conversations = await conversationRepo.findByKnowledgeBaseId(notebookId);
    
    // Filter to only those owned by the user just in case
    const userConversations = conversations.filter(c => c.user_id === user.id);

    return NextResponse.json(userConversations);
  } catch (error: any) {
    console.error("Failed to get conversations:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

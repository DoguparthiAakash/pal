import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/application/services/AuthService';
import { SupabaseConversationRepository } from '@/infrastructure/repositories/SupabaseConversationRepository';

const authService = new AuthService();
const conversationRepo = new SupabaseConversationRepository();

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string, convId: string } }
) {
  try {
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { convId } = params;
    if (!convId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    const conversation = await conversationRepo.findById(convId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conversation.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const messages = await conversationRepo.getMessages(convId);
    
    return NextResponse.json(messages);
  } catch (error: any) {
    console.error("Failed to get conversation messages:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

import { adminClient as supabase } from '@/infrastructure/auth/admin';
import { ConversationRepository } from '@/domain/interfaces';
import { Conversation, Message } from '@/domain/entities';
import { config } from '@/config';

export class SupabaseConversationRepository implements ConversationRepository {
  private supabase;

  constructor() {
    this.supabase = supabase;
  }

  async findById(id: string): Promise<Conversation | null> {
    const { data, error } = await this.supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) return null;
    return data as Conversation;
  }

  async findByKnowledgeBaseId(kbId: string): Promise<Conversation[]> {
    const { data, error } = await this.supabase
      .from('conversations')
      .select('*')
      .eq('knowledge_base_id', kbId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }
    return data as Conversation[];
  }

  async create(conv: Partial<Conversation>): Promise<Conversation> {
    const { data, error } = await this.supabase
      .from('conversations')
      .insert(conv)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create conversation: ${error.message}`);
    }
    return data as Conversation;
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('conversations')
      .update({ deleted_at: new Date() })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to soft delete conversation: ${error.message}`);
    }
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const { data, error } = await this.supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }
    return data as Message[];
  }

  async addMessage(message: Partial<Message>): Promise<Message> {
    const { data, error } = await this.supabase
      .from('messages')
      .insert(message)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add message: ${error.message}`);
    }
    return data as Message;
  }
}

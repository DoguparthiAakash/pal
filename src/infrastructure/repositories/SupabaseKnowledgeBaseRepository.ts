import { adminClient as supabase } from '@/infrastructure/auth/admin';
import { KnowledgeBaseRepository } from '@/domain/interfaces';
import { KnowledgeBase } from '@/domain/entities';
import { config } from '@/config';

export class SupabaseKnowledgeBaseRepository implements KnowledgeBaseRepository {
  private supabase;

  constructor() {
    this.supabase = supabase;
  }

  async findById(id: string): Promise<KnowledgeBase | null> {
    const { data, error } = await this.supabase
      .from('knowledge_bases')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data as KnowledgeBase;
  }

  async findByUserId(userId: string): Promise<KnowledgeBase[]> {
    const { data, error } = await this.supabase
      .from('knowledge_bases')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch knowledge bases: ${error.message}`);
    }
    return data as KnowledgeBase[];
  }

  async create(kb: Partial<KnowledgeBase>): Promise<KnowledgeBase> {
    const { data, error } = await this.supabase
      .from('knowledge_bases')
      .insert(kb)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create knowledge base: ${error.message}`);
    }
    return data as KnowledgeBase;
  }

  async update(id: string, kb: Partial<KnowledgeBase>): Promise<KnowledgeBase> {
    const { data, error } = await this.supabase
      .from('knowledge_bases')
      .update({ ...kb, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update knowledge base: ${error.message}`);
    }
    return data as KnowledgeBase;
  }
}

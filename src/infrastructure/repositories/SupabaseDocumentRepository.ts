import { adminClient as supabase } from '@/infrastructure/auth/admin';
import { DocumentRepository } from '@/domain/interfaces';
import { Document } from '@/domain/entities';
import { config } from '@/config';

export class SupabaseDocumentRepository implements DocumentRepository {
  private supabase;

  constructor() {
    this.supabase = supabase;
  }

  async findById(id: string): Promise<Document | null> {
    const { data, error } = await this.supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) return null;
    return data as Document;
  }

  async findByKnowledgeBaseId(kbId: string): Promise<Document[]> {
    const { data, error } = await this.supabase
      .from('documents')
      .select('*')
      .eq('knowledge_base_id', kbId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }
    return data as Document[];
  }

  async create(doc: Partial<Document>): Promise<Document> {
    const { data, error } = await this.supabase
      .from('documents')
      .insert(doc)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create document: ${error.message}`);
    }
    return data as Document;
  }

  async update(id: string, doc: Partial<Document>): Promise<Document> {
    const { data, error } = await this.supabase
      .from('documents')
      .update({ ...doc, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update document: ${error.message}`);
    }
    return data as Document;
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('documents')
      .update({ deleted_at: new Date() })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to soft delete document: ${error.message}`);
    }
  }
}

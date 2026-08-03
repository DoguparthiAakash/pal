import { createClient } from '@supabase/supabase-js';
import { VectorStore } from '@/domain/interfaces';
import { Chunk } from '@/domain/entities';
import { config } from '@/config';

export class SupabaseVectorStore implements VectorStore {
  private supabase;

  constructor() {
    this.supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
  }

  async upsertChunks(chunks: Chunk[]): Promise<void> {
    // Map to DB schema
    const dbChunks = chunks.map(c => ({
      id: c.id,
      document_id: c.document_id,
      knowledge_base_id: c.knowledge_base_id,
      user_id: c.user_id,
      content: c.content,
      embedding: c.embedding ? `[${c.embedding.join(',')}]` : null, // pgvector format
    }));

    const { error } = await this.supabase
      .from('chunks')
      .upsert(dbChunks);

    if (error) {
      throw new Error(`Failed to upsert chunks: ${error.message}`);
    }
  }

  async searchChunks(
    embedding: number[], 
    limit: number, 
    userId: string, 
    knowledgeBaseId: string, 
    threshold: number = 0.7
  ): Promise<(Chunk & { similarity: number })[]> {
    
    // We use the match_chunks_in_kb RPC which strictly enforces 
    // user_id and knowledge_base_id at the database level for isolation.
    const { data, error } = await this.supabase.rpc('match_chunks_in_kb', {
      query_embedding: `[${embedding.join(',')}]`,
      match_count: limit,
      p_knowledge_base_id: knowledgeBaseId,
      p_user_id: userId,
      similarity_threshold: threshold
    });

    if (error) {
      throw new Error(`Failed to search chunks: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      document_id: row.document_id,
      knowledge_base_id: knowledgeBaseId,
      user_id: userId,
      content: row.content,
      similarity: row.similarity
    }));
  }

  async deleteChunksByDocument(documentId: string): Promise<void> {
    const { error } = await this.supabase
      .from('chunks')
      .delete()
      .eq('document_id', documentId);

    if (error) {
      throw new Error(`Failed to delete chunks: ${error.message}`);
    }
  }
}

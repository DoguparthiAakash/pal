export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: string;
  created_at: Date;
  updated_at: Date;
  documents_uploaded: number;
  storage_used: number;
  messages_used: number;
  last_active: Date;
}

export interface KnowledgeBase {
  id: string;
  user_id: string;
  title: string;
  is_default: boolean;
  settings: {
    embedding_provider: string;
    llm_provider: string;
    chunk_size: number;
    chunk_overlap: number;
    top_k: number;
    similarity_threshold: number;
    max_context_length: number;
    temperature: number;
    system_prompt?: string;
    retrieval_strategy: string;
  };
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export type DocumentStatus = 'Pending' | 'Processing' | 'Ready' | 'Failed';

export interface Document {
  id: string;
  knowledge_base_id: string;
  user_id: string; // Redundant but good for quick authorization without joins
  title: string;
  original_name: string;
  storage_path: string;
  mime_type: string;
  size: number;
  status: DocumentStatus;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface Chunk {
  id: string;
  document_id: string;
  knowledge_base_id: string;
  user_id: string;
  content: string;
  embedding?: number[];
}

export interface Conversation {
  id: string;
  knowledge_base_id: string;
  user_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources: {
    document_ids: string[];
    chunk_ids: string[];
    scores: number[];
  };
  provider_used?: string;
  generation_metadata?: any;
  created_at: Date;
}

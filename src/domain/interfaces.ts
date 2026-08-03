import { Chunk, Conversation, Document, KnowledgeBase, Message, User } from './entities';

export interface StorageProvider {
  uploadFile(path: string, file: Buffer | Blob): Promise<{ path: string; url: string }>;
  downloadFile(path: string): Promise<Buffer>;
  deleteFile(path: string): Promise<void>;
  getSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;
}

export interface EmbeddingProvider {
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  getEmbeddingDimension(): number;
}

export interface VectorStore {
  upsertChunks(chunks: Chunk[]): Promise<void>;
  searchChunks(
    embedding: number[], 
    limit: number, 
    userId: string, 
    knowledgeBaseId: string, 
    threshold?: number
  ): Promise<(Chunk & { similarity: number })[]>;
  deleteChunksByDocument(documentId: string): Promise<void>;
}

export interface LLMProvider {
  generateText(
    systemPrompt: string, 
    messages: { role: string; content: string }[], 
    options?: any
  ): Promise<string>;
  streamText(
    systemPrompt: string, 
    messages: { role: string; content: string }[], 
    options?: any
  ): Promise<ReadableStream>;
}

export interface RateLimiter {
  checkLimit(identifier: string, limit: number, windowSeconds: number): Promise<{ success: boolean; limit: number; remaining: number; reset: number }>;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  upsert(user: User): Promise<User>;
}

export interface KnowledgeBaseRepository {
  findById(id: string): Promise<KnowledgeBase | null>;
  findByUserId(userId: string): Promise<KnowledgeBase[]>;
  create(kb: Partial<KnowledgeBase>): Promise<KnowledgeBase>;
  update(id: string, kb: Partial<KnowledgeBase>): Promise<KnowledgeBase>;
}

export interface DocumentRepository {
  findById(id: string): Promise<Document | null>;
  findByKnowledgeBaseId(kbId: string): Promise<Document[]>;
  create(doc: Partial<Document>): Promise<Document>;
  update(id: string, doc: Partial<Document>): Promise<Document>;
  softDelete(id: string): Promise<void>;
}

export interface ConversationRepository {
  findById(id: string): Promise<Conversation | null>;
  findByKnowledgeBaseId(kbId: string): Promise<Conversation[]>;
  create(conv: Partial<Conversation>): Promise<Conversation>;
  softDelete(id: string): Promise<void>;
  
  // Messages
  getMessages(conversationId: string): Promise<Message[]>;
  addMessage(message: Partial<Message>): Promise<Message>;
}

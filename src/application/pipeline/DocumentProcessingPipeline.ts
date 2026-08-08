import { v4 as uuidv4 } from 'uuid';
import { StorageProvider, EmbeddingProvider, VectorStore, DocumentRepository } from '@/domain/interfaces';
import { KnowledgeBase, User, Document, Chunk } from '@/domain/entities';
import { ObservabilityService } from '@/application/services/ObservabilityService';

// Document Parsing
import officeParser from 'officeparser';

export class DocumentProcessingPipeline {
  constructor(
    private storageProvider: StorageProvider,
    private embeddingProvider: EmbeddingProvider,
    private vectorStore: VectorStore,
    private documentRepo: DocumentRepository,
    private observer: ObservabilityService
  ) {}

  async process(user: User, kb: KnowledgeBase, filePath: string, fileName: string, mimeType: string, size: number): Promise<Document> {
    const docId = uuidv4();

    // 1. Initial Document Record (Pending)
    const documentRecord = await this.documentRepo.create({
      id: docId,
      knowledge_base_id: kb.id,
      user_id: user.id,
      title: fileName,
      original_name: fileName,
      storage_path: filePath,
      mime_type: mimeType,
      size: size,
      status: 'Pending',
    });

    try {
      // 2. Download from Storage (previously uploaded by client)
      const buffer = await this.observer.traceAsync('download', user.id, async () => {
        await this.documentRepo.update(docId, { status: 'Processing' });
        return await this.storageProvider.downloadFile(filePath);
      }, { docId });

      // 3. Extract & Chunk
      const chunks = await this.observer.traceAsync('chunking', user.id, async () => {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        const ast = await officeParser.parseOffice(buffer, { fileType: ext } as any);
        const text = ast.toText();
        
        return this.chunkText(text, kb.settings.chunk_size, kb.settings.chunk_overlap);
      }, { docId });

      // 5. Embed
      const embeddings = await this.observer.traceAsync('embedding', user.id, async () => {
        return await this.embeddingProvider.generateEmbeddings(chunks);
      }, { docId, chunkCount: chunks.length });

      // 6. Vectorize
      await this.observer.traceAsync('vector_insert', user.id, async () => {
        const dbChunks: Chunk[] = chunks.map((content, i) => ({
          id: uuidv4(),
          document_id: docId,
          knowledge_base_id: kb.id,
          user_id: user.id,
          content,
          embedding: embeddings[i],
        }));

        await this.vectorStore.upsertChunks(dbChunks);
      }, { docId, chunkCount: chunks.length });

      // 7. Ready
      return await this.documentRepo.update(docId, { status: 'Ready' });

    } catch (error) {
      await this.documentRepo.update(docId, { status: 'Failed' });
      throw error;
    }
  }

  private chunkText(text: string, chunkSize: number, chunkOverlap: number): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
      chunks.push(text.slice(i, i + chunkSize));
      i += chunkSize - chunkOverlap;
    }
    return chunks;
  }
}

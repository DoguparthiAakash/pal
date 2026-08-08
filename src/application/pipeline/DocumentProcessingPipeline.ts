import { v4 as uuidv4 } from 'uuid';
import { StorageProvider, EmbeddingProvider, VectorStore, DocumentRepository } from '@/domain/interfaces';
import { KnowledgeBase, User, Document, Chunk } from '@/domain/entities';
import { ObservabilityService } from '@/application/services/ObservabilityService';

// PDF Parsing (We rely on standard pdf-parse or similar, keeping this abstract)
import pdfParse from 'pdf-parse';

export class DocumentProcessingPipeline {
  constructor(
    private storageProvider: StorageProvider,
    private embeddingProvider: EmbeddingProvider,
    private vectorStore: VectorStore,
    private documentRepo: DocumentRepository,
    private observer: ObservabilityService
  ) {}

  async process(file: File, user: User, kb: KnowledgeBase): Promise<Document> {
    const docId = uuidv4();
    const filePath = `uploads/${user.id}/${docId}.pdf`;

    // 1. Initial Document Record (Pending)
    const documentRecord = await this.documentRepo.create({
      id: docId,
      knowledge_base_id: kb.id,
      user_id: user.id,
      title: file.name,
      original_name: file.name,
      storage_path: filePath,
      mime_type: file.type,
      size: file.size,
      status: 'Pending',
    });

    try {
      // 2. Validate
      if (file.type !== 'application/pdf') {
        throw new Error('Only PDF files are supported.');
      }

      // 3. Storage
      await this.observer.traceAsync('upload', user.id, async () => {
        await this.documentRepo.update(docId, { status: 'Processing' });
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await this.storageProvider.uploadFile(filePath, buffer);
      }, { docId });

      // 4. Extract & Chunk
      const chunks = await this.observer.traceAsync('chunking', user.id, async () => {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const pdfData = await pdfParse(buffer);
        const text = pdfData.text;
        
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

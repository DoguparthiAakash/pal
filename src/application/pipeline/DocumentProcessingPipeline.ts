import { v4 as uuidv4 } from 'uuid';
import { StorageProvider, EmbeddingProvider, VectorStore, DocumentRepository } from '@/domain/interfaces';
import { KnowledgeBase, User, Document, Chunk } from '@/domain/entities';
import { ObservabilityService } from '@/application/services/ObservabilityService';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { config } from '@/config';
import { createServerClient } from '@/infrastructure/auth/server';
import { TavilyClient } from '@/infrastructure/tavily/TavilyClient';

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
      const updatedDoc = await this.documentRepo.update(docId, { status: 'Ready' });
      
      // 8. Generate Artifacts Asynchronously (Fire and forget to not block upload)
      this.generateArtifacts(user, kb, docId, chunks).catch(err => {
        console.error('Artifact generation failed:', err);
      });

      return updatedDoc;

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

  private async generateArtifacts(user: User, kb: KnowledgeBase, docId: string, chunks: string[]) {
    // We process up to first 20 chunks to avoid massive token limits
    const contextText = chunks.slice(0, 20).join('\n\n');
    const groqApiKey = config.providers.llm.groqApiKey;
    if (!groqApiKey || config.providers.llm.provider !== 'groq') return;
    const groq = createGroq({ apiKey: groqApiKey });
    const model = groq('llama-3.1-8b-instant');
    const supabase = await createServerClient();

    // 1. Generate Guide
    const guidePrompt = `Based on the following document context, generate a "getting started" study guide. Avoid messy details, provide a simple overview of where to start and what to learn.\n\nCONTENT:\n${contextText}`;
    const { text: guideText } = await generateText({ model, prompt: guidePrompt });
    await supabase.from('workspace_artifacts').upsert({ knowledge_base_id: kb.id, document_id: docId, type: 'guide', content: { text: guideText } });

    // 2. Generate Notes & Links
    const notesPrompt = `Based on the following document context, generate short bullet point notes on each key topic and main points underneath it. Format as JSON with { "topics": [{ "topic": "Name", "points": ["p1"] }] }.\n\nCONTENT:\n${contextText}`;
    const { text: notesJsonStr } = await generateText({ model, prompt: notesPrompt });
    try {
      const parsedNotes = JSON.parse(notesJsonStr.replace(/```json/g, '').replace(/```/g, ''));
      const tavily = new TavilyClient();
      for (const t of parsedNotes.topics) {
        t.links = await tavily.search(t.topic + ' ' + t.points[0], 3);
      }
      await supabase.from('workspace_artifacts').upsert({ knowledge_base_id: kb.id, document_id: docId, type: 'notes', content: parsedNotes });
    } catch (e) { console.error('Failed to parse notes JSON', e); }

    // 3. Generate Mind Map (UML-like JSON format)
    const mindmapPrompt = `Based on the context, generate a Mind Map splitting topics and sub-topics. Format as JSON matching React Flow nodes/edges: { "nodes": [{ "id": "1", "data": { "label": "Topic" }, "position": { "x": 0, "y": 0 } }], "edges": [{ "id": "e1-2", "source": "1", "target": "2" }] }.\n\nCONTENT:\n${contextText}`;
    const { text: mindmapJsonStr } = await generateText({ model, prompt: mindmapPrompt });
    try {
      const parsedMindmap = JSON.parse(mindmapJsonStr.replace(/```json/g, '').replace(/```/g, ''));
      await supabase.from('workspace_artifacts').upsert({ knowledge_base_id: kb.id, document_id: docId, type: 'mindmap', content: parsedMindmap });
    } catch (e) { console.error('Failed to parse mindmap JSON', e); }
    
    // 4. Extract Memory Nodes/Edges (Obsidian graph)
    const memoryPrompt = `Extract key entities, concepts, and their relationships from the context. Format as JSON: { "nodes": [{ "id": "uuid", "label": "Concept", "type": "concept" }], "edges": [{ "source": "uuid1", "target": "uuid2", "relationship": "relates_to" }] }\n\nCONTENT:\n${contextText}`;
    const { text: memoryJsonStr } = await generateText({ model, prompt: memoryPrompt });
    try {
      const parsedMemory = JSON.parse(memoryJsonStr.replace(/```json/g, '').replace(/```/g, ''));
      for (const node of parsedMemory.nodes || []) {
        await supabase.from('memory_nodes').upsert({ id: node.id || uuidv4(), knowledge_base_id: kb.id, document_id: docId, label: node.label, type: node.type || 'concept' });
      }
      for (const edge of parsedMemory.edges || []) {
        await supabase.from('memory_edges').insert({ source_node_id: edge.source, target_node_id: edge.target, relationship_type: edge.relationship || 'relates_to' });
      }
    } catch (e) { console.error('Failed to parse memory graph JSON', e); }
  }
}

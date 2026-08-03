# RAG Pipeline

PAL's RAG Pipeline is heavily decoupled to support asynchronous queues, serverless scaling, and seamless provider replacement.

## Upload Pipeline (Ingestion)

To prevent Vercel 10-second timeout limits and memory exhaustion, ingestion is designed around an event-driven queue architecture. While currently executed synchronously, the boundary is explicit.

```mermaid
graph TD
    Client -->|Upload File| Route[/api/v1/ingest]
    Route --> Context[Build RequestContext]
    Context --> Submit[Pipeline.submit]
    Submit --> Storage[Save to StorageProvider]
    Submit --> DB[Create Document 'PENDING']
    Submit --> EventBus[Publish 'DocumentUploaded' Event]
    EventBus --> Worker[Background Worker / QueueService]
    
    Worker --> Chunking[Chunking Service]
    Chunking --> Embedding[EmbeddingProvider]
    Embedding --> VectorDB[VectorStore.upsert]
    VectorDB --> Ready[Mark Document 'READY']
```

## Retrieval Pipeline

```mermaid
graph TD
    Client -->|Ask Question| Route[/api/v1/chat]
    Route --> Context[Build RequestContext]
    Context --> ChatService[ChatService]
    ChatService --> QueryEmbed[EmbeddingProvider.generate(query)]
    QueryEmbed --> VectorSearch[VectorStore.search(queryEmbedding, kbId)]
    VectorSearch --> ContextBuilder[Prompt Context Builder]
    ContextBuilder --> LLM[LLMProvider.generate(prompt)]
    LLM --> Stream[Stream HTTP Response]
    Stream --> Client
```

## Prompt Builder & Citations
The Prompt Builder combines the raw user query with the retrieved chunks and formats them according to the configured LLM's system prompt instructions. Chunks are passed with their source document metadata to allow the LLM to generate precise citations.

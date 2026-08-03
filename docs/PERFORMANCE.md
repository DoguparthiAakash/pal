# Performance Optimizations

PAL is engineered for Vercel Serverless constraints: Limited Memory, Execution Time limits, and Cold Starts.

## Memory Optimization
- **Streaming Parsers**: Large documents (PDFs, CSVs) are processed using streaming parsers to avoid loading multi-megabyte buffers into Vercel memory limits (typically 1024MB).
- **No Global Singletons**: Repositories and Providers are lazily instantiated inside the `RequestContext` only when required, preventing bloated global state across cold starts.
- **Stateless Execution**: The application holds no in-memory caches between requests.

## Caching Strategy
- **Vector Indexing**: pgvector utilizes HNSW (Hierarchical Navigable Small World) indexing for ultra-low latency approximate nearest neighbor (ANN) searches.
- **Response Caching**: If applicable, identical vector queries may be cached using Vercel Data Cache or Upstash Redis.

## Streaming Execution
To avoid the Vercel 10s-15s timeout limit on serverless functions, the `/api/v1/chat` endpoint immediately flushes headers and streams LLM tokens back to the client using `ReadableStream`.

## Telemetry
The `ObservabilityService` captures:
- Cold start delay.
- Memory peaks (using `process.memoryUsage()`).
- Vector search latency.
- LLM generation latency.

This telemetry is embedded in the `RequestContext` and flushed asynchronously at the end of the request to prevent blocking the response.

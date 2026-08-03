# API Versioning

All API routes in PAL are versioned under `/api/v1/` to ensure long-term stability for clients and integrations.

## Core Endpoints

### `POST /api/v1/ingest`
Uploads a document to a specific Knowledge Base.
- **Request**: `multipart/form-data` (file, knowledgeBaseId)
- **Response**: `{ status: 'PENDING', documentId: 'uuid' }`

### `POST /api/v1/chat`
Sends a message to a conversation within a Knowledge Base.
- **Request**: `application/json` (conversationId, message, knowledgeBaseId)
- **Response**: Server-Sent Events (SSE) Stream

### `GET /api/v1/search`
Performs a raw semantic search against a Knowledge Base.
- **Request**: `?query=...&kb=...`
- **Response**: `[ { chunkId, documentId, content, score } ]`

## Health Endpoints

### `GET /api/v1/health`
Returns deep infrastructure health.
- **Response**: `{ status: 'ok', db: 'up', vectorStore: 'up', llm: 'up' }`

### `GET /api/v1/ready`
Liveness probe for deployment readiness.

### `GET /api/v1/version`
Returns the current deployed application version and commit hash.

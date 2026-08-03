# Security Architecture

## Authentication
Authentication is managed via Supabase OAuth (Google, GitHub). The application never handles raw passwords. Session tokens (JWTs) are stored in secure, HttpOnly cookies using `@supabase/ssr`.

## Authorization & Row Level Security (RLS)
The backend enforces authorization at the database level using strict RLS policies. Even if application logic contains a bug, it is mathematically impossible for a tenant to read another tenant's data.

### Isolated Workspaces (Knowledge Bases)
Data is logically grouped into `knowledge_bases`. 
- `conversations` belong to a `knowledge_base_id`.
- `documents` belong to a `knowledge_base_id`.
- `chunks` belong to a `document_id`.

**Example RLS Policy (Documents)**:
```sql
CREATE POLICY "Users can only view documents in their knowledge bases"
ON documents FOR SELECT
USING (
  knowledge_base_id IN (
    SELECT id FROM knowledge_bases WHERE user_id = auth.uid()
  )
);
```

## Feature Flags & Development Modes
Features that expose sensitive diagnostic data or mock behaviors (e.g., `ENABLE_DEV_LOGIN`, `ENABLE_DEBUG_PANEL`) are hardcoded to `false` in the configuration module if `NODE_ENV === 'production'`, eliminating the risk of accidental exposure.

# Request Flow

## Standard API Request Flow

Every incoming request passes through a strictly defined lifecycle to guarantee security, statelessness, and traceability.

```mermaid
sequenceDiagram
    participant Client
    participant NextRoute as Next.js Route (/api/v1/*)
    participant Auth as Supabase Auth (Middleware)
    participant Context as RequestContextBuilder
    participant Service as Application Service
    participant Provider as ProviderRegistry

    Client->>NextRoute: HTTP Request
    NextRoute->>Auth: Validate JWT
    Auth-->>NextRoute: User Identity
    NextRoute->>Context: build(req, user)
    Context-->>NextRoute: RequestContext (reqId, config, registry)
    NextRoute->>Service: execute(RequestContext, payload)
    Service->>Provider: registry.llm().generate()
    Provider-->>Service: Response
    Service-->>NextRoute: Business Result
    NextRoute-->>Client: HTTP Response
```

## Authentication Flow

Authentication utilizes Supabase SSR with JWTs stored in secure cookies.

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Vercel
    participant Supabase Auth

    User->>Frontend: Clicks "Login with Google"
    Frontend->>Supabase Auth: OAuth PKCE Flow
    Supabase Auth-->>Frontend: Callback with Auth Code
    Frontend->>Vercel: GET /auth/callback?code=...
    Vercel->>Supabase Auth: Exchange Code for Session
    Supabase Auth-->>Vercel: JWT Tokens
    Vercel-->>Frontend: Set-Cookie & Redirect to App
```

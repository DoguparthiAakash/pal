# Architectural Decision Records (ADR)

This document tracks the "WHY" behind architectural decisions.

## 1. Why RequestContext over a Global IoC Container?
**Decision**: We use an immutable `RequestContext` created per-request instead of a global `ProviderFactory`.
**Reason**: Vercel Serverless functions can reuse memory across invocations in unpredictable ways. A global IoC container can leak state or user identity between requests if not managed perfectly. `RequestContext` guarantees that dependencies (and user context) are strictly bounded to the current HTTP request lifecycle.

## 2. Why the Repository Pattern?
**Decision**: Abstracting Supabase DB calls behind Repositories (e.g., `DocumentRepository`).
**Reason**: Coupling business logic directly to Supabase RPCs makes unit testing impossible without a live database. The repository pattern allows us to mock data layers and smoothly transition to alternative databases (e.g., AWS RDS) in the future without rewriting application logic.

## 3. Why a QueueService Abstraction?
**Decision**: Document ingestion is routed through an abstract `EventBus` / `QueueService` even if currently executed synchronously.
**Reason**: Vercel functions timeout after 10-15s (on hobby/pro plans). Processing large PDFs will inevitably hit this timeout. By abstracting the boundary now, we can easily swap in Upstash QStash or Inngest in the future by just writing a new `QueueProvider` class, zeroing out technical debt.

## 4. Why Serverless-First?
**Decision**: Optimizing for stateless Vercel edge/serverless functions.
**Reason**: Serverless guarantees zero-ops auto-scaling. Traditional Node.js architectures (like long-running Express servers with websockets and in-memory caches) break completely under this model.

## 5. Why Vercel is the Source of Truth?
**Decision**: Local development must emulate Vercel, not the other way around.
**Reason**: Bugs caused by "it works on my machine" (e.g., relying on the local filesystem, or keeping a background thread alive) are catastrophic in production. Emulation ensures high confidence deployments.

import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/application/services/AuthService';
import { RetrievalService } from '@/application/services/RetrievalService';
import { ObservabilityService } from '@/application/services/ObservabilityService';
import { SupabaseVectorStore } from '@/infrastructure/vector/SupabaseVectorStore';
import { SupabaseConversationRepository } from '@/infrastructure/repositories/SupabaseConversationRepository';
import { LocalRateLimiter } from '@/infrastructure/rate-limit/LocalRateLimiter';
import { SupabaseKnowledgeBaseRepository } from '@/infrastructure/repositories/SupabaseKnowledgeBaseRepository';
import { SupabaseCacheService } from '@/infrastructure/cache/SupabaseCacheService';
import { EmbeddingProviderFactory } from '@/infrastructure/embeddings/EmbeddingProviderFactory';
import { config } from '@/config';
import { streamText, generateId } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const observer = new ObservabilityService();
const authService = new AuthService();
const rateLimiter = new LocalRateLimiter();
const conversationRepo = new SupabaseConversationRepository();
const kbRepo = new SupabaseKnowledgeBaseRepository();
const embeddingProvider = EmbeddingProviderFactory.create();

const retrievalService = new RetrievalService(
  new SupabaseVectorStore(),
  embeddingProvider,
  observer
);

// OpenRouter uses OpenAI-compatible API — free OSS models available without credits
function createOpenRouterModel(modelId = 'qwen/qwen3-8b:free') {
  const apiKey = config.providers.llm.openrouterApiKey || config.providers.llm.groqApiKey || '';
  const openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    headers: {
      'HTTP-Referer': 'https://pal.app',
      'X-Title': 'PAL',
    },
  });
  return openrouter(modelId);
}

export const maxDuration = 60; // Set max duration for Vercel deployment

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Rate limiting check
    const rateLimit = await rateLimiter.checkLimit(`chat_${user.id}`, config.app.rateLimits.chat.limit, config.app.rateLimits.chat.windowSeconds);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // 3. Parse request
    const { messages, conversation_id, notebookId } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    const lastMsg = messages[messages.length - 1];
    let latestMessage = lastMsg.content || '';
    if (!latestMessage && Array.isArray(lastMsg.parts)) {
      latestMessage = lastMsg.parts.map((p: any) => p.text || '').join('');
    }

    const coreMessages = messages.map((m: any) => {
      let content = m.content;
      if (!content && Array.isArray(m.parts)) {
        content = m.parts.map((p: any) => p.text || '').join('');
      }
      return { role: m.role, content: content || '' };
    });

    // 4. Get KB
    let kb;
    if (notebookId) {
      kb = await kbRepo.findById(notebookId);
    } else {
      kb = await authService.getDefaultKnowledgeBase(user.id);
    }

    if (!kb) {
      return NextResponse.json({ error: 'Knowledge Base not found' }, { status: 400 });
    }

    // 5. Verify/create conversation
    let conversationId = conversation_id;
    if (conversationId) {
      const conv = await conversationRepo.findById(conversationId);
      if (!conv || conv.user_id !== user.id) {
        return NextResponse.json({ error: 'Conversation not found or unauthorized' }, { status: 403 });
      }
    } else {
      const newConv = await conversationRepo.create({
        knowledge_base_id: kb.id,
        user_id: user.id,
        title: latestMessage.substring(0, 50) + '...',
      });
      conversationId = newConv.id;
    }

    // ── 6. Generate query embedding (embedding cache applied inside provider) ──
    const [queryEmbedding] = await embeddingProvider.generateEmbeddings([latestMessage]);

    // ── 7. Semantic Cache Check ────────────────────────────────────────────
    // If a very similar question was answered recently, stream the cached answer
    const cacheHit = await SupabaseCacheService.getCachedResponse(
      queryEmbedding,
      kb.id,
      user.id
    );

    if (cacheHit && cacheHit.similarity >= 0.92) {
      // Save conversation messages for history (fire-and-forget)
      conversationRepo.addMessage({
        conversation_id: conversationId,
        role: 'user',
        content: latestMessage,
        sources: { document_ids: [], chunk_ids: [], scores: [] },
        provider_used: 'cache',
      }).catch(() => {});
      conversationRepo.addMessage({
        conversation_id: conversationId,
        role: 'assistant',
        content: cacheHit.response_text,
        provider_used: 'cache',
      }).catch(() => {});

      // Stream the cached response with a cache indicator header
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // Emit as text/event-stream in Vercel AI SDK UIMessage format
          const chunks = cacheHit.response_text.match(/.{1,50}/g) || [];
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(`0:${JSON.stringify(chunk)}\n`));
          }
          controller.enqueue(encoder.encode(`e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n`));
          controller.close();
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Conversation-Id': conversationId,
          'X-Cache-Hit': 'true',
          'X-Cache-Similarity': String(cacheHit.similarity.toFixed(3)),
        },
      });
    }

    // ── 8. Vector retrieval using normal retrieval (embedding cached inside provider) ──
    const chunks = await retrievalService.retrieveContext(latestMessage, user.id, kb);

    const contextText = chunks.map((c: any) => c.content).join('\n\n');

    // 9. System prompt & Generation
    const systemPrompt = kb.settings.system_prompt || `You are an intelligent assistant. Use the following retrieved context to answer the user's question accurately. If you don't know the answer, just say so.\n\nContext:\n${contextText}`;

    const result = streamText({
      model: createOpenRouterModel('qwen/qwen3-8b:free'),
      system: systemPrompt,
      messages: coreMessages,
      temperature: kb.settings.temperature ?? 0.7,
      onFinish: async ({ text }) => {
        try {
          // Save messages to DB
          await Promise.all([
            conversationRepo.addMessage({
              conversation_id: conversationId,
              role: 'user',
              content: latestMessage,
              sources: {
                document_ids: Array.from(new Set(chunks.map((c: any) => c.document_id))),
                chunk_ids: chunks.map((c: any) => c.id),
                scores: chunks.map((c: any) => (c as any).similarity || 0),
              },
              provider_used: kb.settings.llm_provider,
            }),
            conversationRepo.addMessage({
              conversation_id: conversationId,
              role: 'assistant',
              content: text,
              provider_used: kb.settings.llm_provider,
            }),
          ]);

          // Write to semantic cache (fire-and-forget, non-fatal)
          SupabaseCacheService.setCachedResponse({
            queryText: latestMessage,
            queryEmbedding,
            responseText: text,
            contextChunkIds: chunks.map((c: any) => c.id),
            knowledgeBaseId: kb.id,
            userId: user.id,
          }).catch(() => {});

        } catch (e) {
          console.error('Failed to save messages', e);
        }
      }
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: () => generateId(),
      headers: {
        'X-Conversation-Id': conversationId,
        'X-Cache-Hit': 'false',
      }
    });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

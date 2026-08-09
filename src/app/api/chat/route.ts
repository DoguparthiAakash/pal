import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/application/services/AuthService';
import { RetrievalService } from '@/application/services/RetrievalService';
import { ObservabilityService } from '@/application/services/ObservabilityService';
import { SupabaseVectorStore } from '@/infrastructure/vector/SupabaseVectorStore';
import { GroqLLMProvider } from '@/infrastructure/llm/GroqLLMProvider';
import { SupabaseConversationRepository } from '@/infrastructure/repositories/SupabaseConversationRepository';
import { LocalRateLimiter } from '@/infrastructure/rate-limit/LocalRateLimiter';
import { SupabaseKnowledgeBaseRepository } from '@/infrastructure/repositories/SupabaseKnowledgeBaseRepository';
import { config } from '@/config';
import { streamText, generateId } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { EmbeddingProviderFactory } from '@/infrastructure/embeddings/EmbeddingProviderFactory';
const observer = new ObservabilityService();
const authService = new AuthService();
const rateLimiter = new LocalRateLimiter();
const conversationRepo = new SupabaseConversationRepository();
const kbRepo = new SupabaseKnowledgeBaseRepository();

const retrievalService = new RetrievalService(
  new SupabaseVectorStore(),
  EmbeddingProviderFactory.create(),
  observer
);

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
      return {
        role: m.role,
        content: content || ''
      };
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

    // 5. Verify conversation ownership (if exists)
    let conversationId = conversation_id;
    if (conversationId) {
      const conv = await conversationRepo.findById(conversationId);
      if (!conv || conv.user_id !== user.id) {
        return NextResponse.json({ error: 'Conversation not found or unauthorized' }, { status: 403 });
      }
    } else {
      // Create new conversation
      const newConv = await conversationRepo.create({
        knowledge_base_id: kb.id,
        user_id: user.id,
        title: latestMessage.substring(0, 50) + '...',
      });
      conversationId = newConv.id;
    }

    // 6. Retrieve context
    const chunks = await retrievalService.retrieveContext(latestMessage, user.id, kb);
    const contextText = chunks.map(c => c.content).join('\n\n');

    // 7. System prompt & Generation
    const systemPrompt = kb.settings.system_prompt || `You are an intelligent assistant. Use the following retrieved context to answer the user's question accurately. If you don't know the answer, just say so.\n\nContext:\n${contextText}`;

    const groq = createGroq({ apiKey: config.providers.llm.groqApiKey || '' });

    const result = streamText({
      model: groq('llama-3.1-8b-instant'),
      system: systemPrompt,
      messages: coreMessages,
      temperature: kb.settings.temperature ?? 0.7,
      onFinish: async ({ text }) => {
        // Fire and forget saving the messages to DB asynchronously
        try {
          await conversationRepo.addMessage({
            conversation_id: conversationId,
            role: 'user',
            content: latestMessage,
            sources: {
              document_ids: Array.from(new Set(chunks.map(c => c.document_id))),
              chunk_ids: chunks.map(c => c.id),
              scores: chunks.map(c => (c as any).similarity || 0),
            },
            provider_used: kb.settings.llm_provider
          });
          await conversationRepo.addMessage({
            conversation_id: conversationId,
            role: 'assistant',
            content: text,
            provider_used: kb.settings.llm_provider
          });
        } catch (e) {
          console.error("Failed to save messages", e);
        }
      }
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: () => generateId(),
      headers: {
        'X-Conversation-Id': conversationId,
      }
    });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

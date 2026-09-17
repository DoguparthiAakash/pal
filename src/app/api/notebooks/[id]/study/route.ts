import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/application/services/AuthService';
import { createServerClient } from '@/infrastructure/auth/server';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { config } from '@/config';
import { z } from 'zod';

const authService = new AuthService();

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

export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: notebookId } = await params;
    if (!notebookId) {
      return NextResponse.json({ error: 'Notebook ID is required' }, { status: 400 });
    }

    const supabase = await createServerClient();
    
    // Fetch nodes
    const { data: nodes, error: nodesError } = await supabase
      .from('memory_nodes')
      .select('id, label, type, summary')
      .eq('knowledge_base_id', notebookId);
      
    if (nodesError) throw nodesError;

    if (!nodes || nodes.length === 0) {
      return NextResponse.json({ 
        flashcards: [],
        quiz: []
      });
    }

    // Format nodes for LLM context (take top 50 to avoid token limits on free models)
    const nodesContext = nodes.slice(0, 50).map(n => `- [${n.type}] ${n.label}: ${n.summary || ''}`).join('\n');

    const systemPrompt = `You are an expert tutor. Based on the provided extracted knowledge nodes, generate a study set consisting of:
1. 10 Flashcards (front and back) focusing on the most important concepts, definitions, and entities.
2. A 5-question multiple-choice quiz testing understanding of these concepts.

Context Data (Extracted Knowledge Graph Nodes):
${nodesContext}

Ensure the questions are accurate and directly based on the provided context.`;

    const result = await generateObject({
      model: createOpenRouterModel('qwen/qwen3-8b:free'),
      system: systemPrompt,
      prompt: "Generate the study set.",
      schema: z.object({
        flashcards: z.array(z.object({
          front: z.string(),
          back: z.string()
        })),
        quiz: z.array(z.object({
          question: z.string(),
          options: z.array(z.string()),
          correctOptionIndex: z.number(),
          explanation: z.string()
        }))
      }),
      temperature: 0.5,
    });

    return NextResponse.json(result.object);

  } catch (error: any) {
    console.error('Study API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

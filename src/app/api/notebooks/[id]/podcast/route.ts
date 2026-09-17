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
      return NextResponse.json({ script: [] });
    }

    // Format nodes for LLM context
    const nodesContext = nodes.slice(0, 50).map(n => `- [${n.type}] ${n.label}: ${n.summary || ''}`).join('\n');

    const systemPrompt = `You are a professional podcast script writer. Based on the provided extracted knowledge nodes from a workspace, write a short, engaging 2-host podcast script discussing the key themes.

Host 1 is named "Alex". Alex is the enthusiastic host who asks questions and guides the conversation.
Host 2 is named "Sam". Sam is the knowledgeable expert who explains the concepts clearly.

The script should feel natural, conversational, and accessible to a general audience.
Make it about 10-15 exchanges long.

Context Data (Extracted Knowledge Graph Nodes):
${nodesContext}

Output the script as an array of objects, where each object has "host" (either "Alex" or "Sam") and "text" (what they say).`;

    const result = await generateObject({
      model: createOpenRouterModel('qwen/qwen3-8b:free'),
      system: systemPrompt,
      prompt: "Generate the podcast script.",
      schema: z.object({
        script: z.array(z.object({
          host: z.enum(['Alex', 'Sam']),
          text: z.string()
        }))
      }),
      temperature: 0.7,
    });

    return NextResponse.json(result.object);

  } catch (error: any) {
    console.error('Podcast API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

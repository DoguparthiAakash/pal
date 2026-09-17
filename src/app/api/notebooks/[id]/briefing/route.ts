import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/application/services/AuthService';
import { createServerClient } from '@/infrastructure/auth/server';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { config } from '@/config';

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

export const maxDuration = 60; // Set max duration for Vercel deployment

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
        briefing: "# Executive Briefing\n\nNot enough data parsed yet. Please upload documents and wait for the extraction process to finish." 
      });
    }

    // Format nodes for LLM context
    const nodesContext = nodes.map(n => `- [${n.type}] ${n.label}: ${n.summary || ''}`).join('\n');

    const systemPrompt = `You are an expert executive assistant and analyst. Your task is to generate a comprehensive, actionable, and concise Executive Briefing based on the extracted entities and concepts from a workspace.

Format the output in clean Markdown with the following structure:
# Executive Briefing

## Executive Summary
(A brief 1-2 paragraph overview of the core concepts, themes, and overall context)

## Key Themes & Concepts
(Bullet points grouping the most important ideas or topics)

## Important Entities
(Notable people, organizations, locations, or specific items of interest and why they matter)

## Actionable Insights & Next Steps
(What actions, decisions, or further research should be taken based on this data)

Context Data (Extracted Knowledge Graph Nodes):
${nodesContext}

Write a professional, insightful briefing. Do not hallucinate information outside of the provided context. If the context is sparse, provide the best summary possible.`;

    const result = await generateText({
      model: createOpenRouterModel('qwen/qwen3-8b:free'),
      system: systemPrompt,
      prompt: "Generate the executive briefing.",
      temperature: 0.5,
    });

    return NextResponse.json({ briefing: result.text });

  } catch (error: any) {
    console.error('Briefing API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

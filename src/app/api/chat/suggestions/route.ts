import { NextResponse } from 'next/server';
import { adminClient as supabase } from '@/infrastructure/auth/admin';
import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { generateText, embed } from 'ai';
import { config } from '@/config';

export async function POST(req: Request) {
  try {
    const { messages, userRole, notebookId } = await req.json();
    
    if (!messages || !userRole || !notebookId) {
      return NextResponse.json({ error: 'Missing messages, userRole, or notebookId' }, { status: 400 });
    }
    
    // Normalize messages from UI format (parts) to CoreMessage format (content)
    const normalizedMessages = messages.map((m: any) => ({
      ...m,
      content: typeof m.content === 'string' ? m.content : (m.parts ? m.parts.map((p: any) => p.text || '').join('') : '')
    }));
    
    const lastMessage = normalizedMessages[normalizedMessages.length - 1];
    
    let chunks;
    if (config.providers.llm.provider === 'openai' && config.providers.llm.openaiApiKey) {
      const openai = createOpenAI({ apiKey: config.providers.llm.openaiApiKey });
      const { embedding } = await embed({
        model: openai.embedding('text-embedding-3-small'),
        value: lastMessage.content,
      });
      const { data, error } = await supabase.rpc('match_chunks_in_notebook', {
        query_embedding: embedding,
        match_count: 5,
        user_role: userRole,
        user_id: null,
        p_notebook_id: notebookId
      });
      if (error) throw error;
      chunks = data;
    } else {
      // Fallback: Fetch chunks directly for the notebook if no OpenAI key
      const { data: nds, error: ndError } = await supabase
        .from('notebook_documents')
        .select('document_id')
        .eq('notebook_id', notebookId);
      
      if (ndError) throw ndError;
      
      if (!nds || nds.length === 0) {
        chunks = [];
      } else {
        const docIds = nds.map((nd: any) => nd.document_id);
        const { data: fallbackChunks, error: fcError } = await supabase
          .from('chunks')
          .select('id, document_id, content')
          .in('document_id', docIds)
          .contains('allowed_roles', [userRole])
          .limit(10);
          
        if (fcError) throw fcError;
        chunks = fallbackChunks;
      }
    }
    
    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ suggestions: ["Tell me more about this notebook.", "What documents are available?"] });
    }
    
    let contextText = chunks.map((c: any) => c.content).join('\n\n');
    if (contextText.length > 10000) {
      contextText = contextText.substring(0, 10000) + '\n\n... [Content truncated due to API context limits]';
    }
    
    if (config.providers.llm.provider === 'groq' && config.providers.llm.groqApiKey) {
      const groq = createGroq({ apiKey: config.providers.llm.groqApiKey });
      const systemPrompt = `You are a helpful company assistant. Based on the following conversation and the context provided, generate exactly 3 short follow-up questions the user could ask next.
Return the questions as a JSON array of strings. Do not include markdown formatting or extra text.

CONTEXT:
${contextText}
`;

      const result = await generateText({
        model: groq('llama-3.1-8b-instant'),
        system: systemPrompt,
        messages: normalizedMessages,
      });
      
      try {
        let jsonStr = result.text.trim();
        if (jsonStr.startsWith('```json')) {
          jsonStr = jsonStr.replace(/```json\n?/, '').replace(/```\n?$/, '');
        }
        const suggestions = JSON.parse(jsonStr);
        return NextResponse.json({ suggestions });
      } catch (e) {
        return NextResponse.json({ suggestions: ["Tell me more about this notebook.", "What documents are available?"] });
      }
    } else {
      return NextResponse.json({ suggestions: ["Tell me more about this notebook.", "What documents are available?", "Summarize the latest document."] });
    }

  } catch (err: any) {
    console.error('Suggestions error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

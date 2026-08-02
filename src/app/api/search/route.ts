import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';

export async function POST(req: Request) {
  try {
    const { query, context, messages } = await req.json();
    let searchQuery = query;

    // Use Groq to determine the best search query based on the conversation context
    if (process.env.GROQ_API_KEY) {
      try {
        let promptText = "";
        if (messages && messages.length > 0) {
          const conversation = messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content.substring(0, 500)}`).join('\n');
          promptText = `Conversation:\n${conversation}\n\nWhat is the most relevant 2-5 word search query to find more info on the web about the user's latest topic?`;
        } else if (context) {
          promptText = `User asked: ${query}\nAssistant replied: ${context.substring(0, 500)}\n\nWhat is the most relevant 2-5 word search query to find more info on the web?`;
        }

        if (promptText) {
          const result = await generateText({
            model: groq('llama-3.1-8b-instant'),
            system: 'You are an AI assistant that extracts the single most relevant search query based on a conversation. Return ONLY the search query text, no quotes or explanation. The query should be optimized for a search engine.',
            prompt: promptText
          });
          if (result.text) {
            searchQuery = result.text.trim().replace(/['"]/g, '');
          }
        }
      } catch (e) {
        console.error('Groq query generation failed:', e);
      }
    }

    if (!process.env.TAVILY_API_KEY) {
      return NextResponse.json({ 
        topics: [
          { query: "Search API Key Missing", snippet: "Please add TAVILY_API_KEY to your environment variables to enable live web searches.", url: "https://tavily.com" }
        ]
      });
    }

    // Call Tavily API for Search results
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: searchQuery,
        search_depth: "basic",
        max_results: 4
      })
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.statusText}`);
    }

    const data = await response.json();
    const topics = (data.results || []).slice(0, 4).map((item: any) => ({
      query: item.title,
      snippet: item.content,
      url: item.url
    }));

    return NextResponse.json({ topics });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({ error: 'Failed to fetch search results' }, { status: 500 });
  }
}

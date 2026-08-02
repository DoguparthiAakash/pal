import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';

export async function POST(req: Request) {
  try {
    const { query, context } = await req.json();
    let searchQuery = query;

    // Use Groq to determine the best search query based on the conversation context
    if (context && process.env.GROQ_API_KEY) {
      try {
        const result = await generateText({
          model: groq('llama-3.3-70b-versatile'),
          system: 'You are an AI assistant that extracts the single most relevant search query based on a conversation. Return ONLY the search query text, no quotes or explanation.',
          prompt: `User asked: ${query}\nAssistant replied: ${context.substring(0, 500)}\n\nWhat is the most relevant 2-5 word search query to find more info on the web?`
        });
        if (result.text) {
          searchQuery = result.text.trim().replace(/['"]/g, '');
        }
      } catch (e) {
        console.error('Groq query generation failed:', e);
      }
    }

    if (!process.env.SERPER_API_KEY) {
      return NextResponse.json({ 
        topics: [
          { query: "Search API Key Missing", snippet: "Please add SERPER_API_KEY to your environment variables to enable live web searches.", url: "https://serper.dev" }
        ]
      });
    }

    // Call Serper.dev API for Google Search results
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        q: searchQuery,
        num: 4
      })
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.statusText}`);
    }

    const data = await response.json();
    const topics = (data.organic || []).slice(0, 4).map((item: any) => ({
      query: item.title,
      snippet: item.snippet,
      url: item.link
    }));

    return NextResponse.json({ topics });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({ error: 'Failed to fetch search results' }, { status: 500 });
  }
}

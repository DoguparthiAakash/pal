import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';

export async function POST(req: Request) {
  try {
    const { query, context } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    
    if (!accessKey) {
      console.warn("Missing UNSPLASH_ACCESS_KEY");
      return NextResponse.json({ images: [] });
    }
    
    let searchKeyword = query;
    if (context && process.env.GROQ_API_KEY) {
      try {
        const result = await generateText({
          model: groq('llama-3.3-70b-versatile'),
          system: 'You are an expert at extracting highly visual search terms for stock photo databases (Unsplash). Given the user query and the AI response context, output exactly 1 to 3 words (separated by spaces, no punctuation, no quotes) that best represent the core visual subject. Examples: "matrix code", "server rack", "cpu processor", "business meeting".',
          prompt: `Query: ${query}\nContext: ${context.substring(0, 500)}`
        });
        searchKeyword = result.text.trim().replace(/[^a-zA-Z0-9 ]/g, '');
      } catch (e) {
        console.warn("Failed to generate optimized search keyword:", e);
      }
    }
    
    let results;
    try {
      const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchKeyword)}&per_page=8`, {
        headers: {
          'Authorization': `Client-ID ${accessKey}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Unsplash API error: ${response.statusText}`);
      }
      
      results = await response.json();
    } catch (err: any) {
      console.warn("Unsplash image search failed, falling back to empty results:", err.message);
      return NextResponse.json({ images: [] });
    }
    
    if (!results || !results.results || results.results.length === 0) {
      return NextResponse.json({ images: [] });
    }
    
    const images = results.results.map((r: any) => ({
      url: r.urls.regular,
      thumbnail: r.urls.thumb,
      title: r.alt_description || "Image",
      source: r.links.html
    }));

    return NextResponse.json({ images });

  } catch (error: any) {
    console.error('Error fetching images:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

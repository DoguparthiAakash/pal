import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    
    if (!accessKey) {
      console.warn("Missing UNSPLASH_ACCESS_KEY");
      return NextResponse.json({ images: [] });
    }
    
    let results;
    try {
      const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=8`, {
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

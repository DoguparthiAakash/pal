import { NextResponse } from 'next/server';
import { search, searchImages, SafeSearchType } from 'duck-duck-scrape';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Try an image search
    let results;
    try {
      results = await searchImages(query, { safeSearch: SafeSearchType.OFF as any });
    } catch (err: any) {
      console.warn("DuckDuckGo image search failed, falling back to empty results:", err.message);
      return NextResponse.json({ images: [] });
    }
    
    if (!results || !results.results || results.results.length === 0) {
      return NextResponse.json({ images: [] });
    }
    
    const images = results.results.slice(0, 8).map(r => ({
      url: r.image,
      thumbnail: r.thumbnail,
      title: r.title,
      source: r.source
    }));

    return NextResponse.json({ images });

  } catch (error: any) {
    console.error('Error fetching images:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

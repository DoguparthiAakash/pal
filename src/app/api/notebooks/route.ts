import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabase.from('notebooks').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("GET /api/notebooks ERROR:", err);
    return NextResponse.json({ error: err.message || JSON.stringify(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { title } = await req.json();
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    
    const { data, error } = await supabase.from('notebooks').insert({ title }).select().single();
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("POST /api/notebooks ERROR:", err);
    return NextResponse.json({ error: err.message || JSON.stringify(err) }, { status: 500 });
  }
}

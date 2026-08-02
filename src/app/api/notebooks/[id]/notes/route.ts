import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // We should probably filter by user, but since we don't have auth, we return all notes for the notebook
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('notebook_id', id)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { chunk_id, content, userRole } = await req.json();
    
    if (!content || !userRole) {
      return NextResponse.json({ error: 'Missing content or userRole' }, { status: 400 });
    }
    
    const { data, error } = await supabase
      .from('notes')
      .insert({
        notebook_id: id,
        chunk_id: chunk_id || null, // Optional if it's a general note
        content,
        created_by_role: userRole
      })
      .select();
      
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

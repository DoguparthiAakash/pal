import { NextResponse } from 'next/server';
import { createServerClient } from '@/infrastructure/auth/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    
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
    const { chunk_id, content } = await req.json();
    
    if (!content) {
      return NextResponse.json({ error: 'Missing content' }, { status: 400 });
    }
    
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { data, error } = await supabase
      .from('notes')
      .insert({
        notebook_id: id,
        user_id: user.id,
        content
      })
      .select();
      
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

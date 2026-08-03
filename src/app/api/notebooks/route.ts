import { NextResponse } from 'next/server';
import { createServerClient } from '@/infrastructure/auth/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createServerClient();
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
    
    const supabase = await createServerClient();
    
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { data, error } = await supabase.from('notebooks').insert({ 
      title,
      owner_id: user.id 
    }).select().single();
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("POST /api/notebooks ERROR:", err);
    return NextResponse.json({ error: err.message || JSON.stringify(err) }, { status: 500 });
  }
}

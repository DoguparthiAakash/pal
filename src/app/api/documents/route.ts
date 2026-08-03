import { NextResponse } from 'next/server';
import { createServerClient } from '@/infrastructure/auth/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: docs, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    return NextResponse.json(docs);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


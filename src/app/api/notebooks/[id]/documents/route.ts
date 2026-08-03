import { NextResponse } from 'next/server';
import { createServerClient } from '@/infrastructure/auth/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    
    // Get all documents in this knowledge base
    const { data: docs, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('knowledge_base_id', id)
      .order('created_at', { ascending: false });
      
    if (docError) throw docError;
    
    return NextResponse.json(docs);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { document_id } = await req.json();
    const supabase = await createServerClient();
    
    if (!document_id) return NextResponse.json({ error: 'document_id is required' }, { status: 400 });
    
    const { data, error } = await supabase
      .from('documents')
      .update({ knowledge_base_id: id })
      .eq('id', document_id)
      .select();
      
    if (error) {
      throw error;
    }
    
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error linking document:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

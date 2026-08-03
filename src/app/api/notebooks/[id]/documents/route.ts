import { NextResponse } from 'next/server';
import { createServerClient } from '@/infrastructure/auth/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    
    // Get all documents in this notebook
    const { data: nds, error: ndError } = await supabase
      .from('notebook_documents')
      .select('document_id')
      .eq('notebook_id', id);
      
    if (ndError) throw ndError;
    
    if (!nds || nds.length === 0) return NextResponse.json([]);
    
    const docIds = nds.map((nd: any) => nd.document_id);
    
    const { data: docs, error: docError } = await supabase
      .from('documents')
      .select('*')
      .in('id', docIds)
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
      .from('notebook_documents')
      .insert({ notebook_id: id, document_id })
      .select();
      
    if (error) {
      if (error.code === '23505' || error.message?.includes('unique constraint')) {
        // Unique constraint violation (already linked)
        return NextResponse.json({ error: 'This source is already linked to the workspace.' }, { status: 400 });
      }
      throw error;
    }
    
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error linking document:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

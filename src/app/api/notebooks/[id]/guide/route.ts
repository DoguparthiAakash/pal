import { NextResponse } from 'next/server';
import { createServerClient } from '@/infrastructure/auth/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    
    const { data: artifacts, error } = await supabase
      .from('workspace_artifacts')
      .select('content')
      .eq('knowledge_base_id', id)
      .eq('type', 'guide');
      
    if (error) throw error;

    if (!artifacts || artifacts.length === 0) {
      return NextResponse.json({ guide: 'Processing your document to generate a guide...' });
    }

    // Combine guides if multiple documents exist
    const combinedGuide = artifacts.map((a, i) => `### Document ${i + 1}\n${a.content.text}`).join('\n\n');

    return NextResponse.json({ guide: combinedGuide });

  } catch (err: any) {
    console.error('Guide error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

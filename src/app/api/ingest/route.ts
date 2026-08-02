import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { openai } from '@ai-sdk/openai';
import { embedMany } from 'ai';
if (typeof global !== 'undefined' && !(global as any).DOMMatrix) {
  (global as any).DOMMatrix = class {};
}
const pdfParse = require('pdf-parse');
import mammoth from 'mammoth';

// A simple recursive chunker by words
function chunkText(text: string, maxTokens: number = 400): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;
  
  for (const word of words) {
    if (currentLength + 1 > maxTokens) {
      chunks.push(currentChunk.join(' '));
      // ~15% overlap -> 60 words
      const overlap = currentChunk.slice(-60);
      currentChunk = [...overlap, word];
      currentLength = overlap.length + 1;
    } else {
      currentChunk.push(word);
      currentLength++;
    }
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }
  
  return chunks;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const allowedRolesStr = formData.get('allowed_roles') as string;
    
    if (!file || !allowedRolesStr) {
      return NextResponse.json({ error: 'Missing file or allowed_roles' }, { status: 400 });
    }
    
    const allowedRoles = allowedRolesStr.split(',').map(r => r.trim()).filter(Boolean);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let text = '';
    
    if (file.name.endsWith('.pdf')) {
      const parsed = await pdfParse(buffer);
      text = parsed.text;
    } else if (file.name.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      // assume text/markdown
      text = buffer.toString('utf-8');
    }
    
    // PostgreSQL does not support null bytes (\u0000) in text fields
    text = text.replace(/\0/g, '');
    
    if (!text.trim()) {
      return NextResponse.json({ error: 'No text extracted' }, { status: 400 });
    }

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        title: file.name,
        allowed_roles: allowedRoles,
        allowed_user_ids: []
      })
      .select()
      .single();
      
    if (docError) throw docError;

    // Upload the file to Supabase Storage so it can be viewed later
    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(`${doc.id}`, buffer, {
        contentType: file.type || 'application/pdf',
        upsert: true
      });
      
    if (storageError) {
      console.warn('Failed to upload file to storage, but text was extracted:', storageError);
    }

    const chunks = chunkText(text);
    
    let embeddings: number[][] = [];
    if (process.env.OPENAI_API_KEY) {
      const { embeddings: e } = await embedMany({
        model: openai.embedding('text-embedding-3-small'),
        values: chunks,
      });
      embeddings = e;
    } else {
      embeddings = chunks.map(() => Array(1536).fill(Math.random() * 0.2 - 0.1));
    }
    
    const chunkRows = chunks.map((chunk, i) => ({
      document_id: doc.id,
      content: chunk,
      embedding: embeddings[i],
      allowed_roles: allowedRoles,
      allowed_user_ids: []
    }));
    
    const { error: chunkError } = await supabase.from('chunks').insert(chunkRows);
    
    if (chunkError) throw chunkError;

    return NextResponse.json({ success: true, docId: doc.id, chunksCount: chunks.length });
  } catch (err: any) {
    console.error('Ingest error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

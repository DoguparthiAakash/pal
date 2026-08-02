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
    const contentType = req.headers.get('content-type') || '';
    let docId, fileName, allowedRolesStr;
    let buffer: Buffer;
    
    if (contentType.includes('application/json')) {
      const body = await req.json();
      docId = body.docId;
      fileName = body.fileName;
      allowedRolesStr = body.allowedRoles;
      
      if (!docId || !fileName || !allowedRolesStr) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }
      
      const { data, error } = await supabase.storage.from('documents').download(docId);
      if (error || !data) {
        throw new Error('Failed to download document from storage for processing');
      }
      
      const arrayBuffer = await data.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      // Legacy FormData fallback
      const formData = await req.formData();
      const file = formData.get('file') as File;
      allowedRolesStr = formData.get('allowed_roles') as string;
      
      if (!file || !allowedRolesStr) {
        return NextResponse.json({ error: 'Missing file or allowed_roles' }, { status: 400 });
      }
      
      fileName = file.name;
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }
    
    const allowedRoles = allowedRolesStr.split(',').map((r: string) => r.trim()).filter(Boolean);
    
    let text = '';
    
    if (fileName.endsWith('.pdf')) {
      const parsed = await pdfParse(buffer);
      text = parsed.text;
    } else if (fileName.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      text = buffer.toString('utf-8');
    }
    
    // PostgreSQL does not support null bytes (\u0000) in text fields
    text = text.replace(/\0/g, '');
    
    if (!text.trim()) {
      return NextResponse.json({ error: 'No text extracted' }, { status: 400 });
    }

    let insertId = docId;
    let doc;
    
    if (insertId) {
       const { data, error } = await supabase.from('documents').insert({ id: insertId, title: fileName, allowed_roles: allowedRoles, allowed_user_ids: [] }).select().single();
       if (error) throw error;
       doc = data;
    } else {
       const { data, error } = await supabase.from('documents').insert({ title: fileName, allowed_roles: allowedRoles, allowed_user_ids: [] }).select().single();
       if (error) throw error;
       doc = data;
       insertId = doc.id;
       // Upload the file to Supabase Storage if it was FormData (legacy)
       const { error: storageError } = await supabase.storage.from('documents').upload(insertId, buffer, { upsert: true });
       if (storageError) console.error("Storage error:", storageError);
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

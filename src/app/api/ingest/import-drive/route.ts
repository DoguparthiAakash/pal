import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/application/services/AuthService';
import { DocumentProcessingPipeline } from '@/application/pipeline/DocumentProcessingPipeline';
import { ObservabilityService } from '@/application/services/ObservabilityService';
import { SupabaseStorageProvider } from '@/infrastructure/storage/SupabaseStorageProvider';
import { SupabaseVectorStore } from '@/infrastructure/vector/SupabaseVectorStore';
import { EmbeddingProviderFactory } from '@/infrastructure/embeddings/EmbeddingProviderFactory';
import { SupabaseDocumentRepository } from '@/infrastructure/repositories/SupabaseDocumentRepository';
import { createServerClient } from '@/infrastructure/auth/server';

export const maxDuration = 60;

/**
 * POST /api/ingest/import-drive
 * Downloads a file from the user's Google Drive and ingests it.
 * 
 * Body: { fileId: string, fileName: string, mimeType: string, notebookId: string }
 * 
 * The Google access token is read from the user's current Supabase session
 * (set during the drive-connect OAuth flow with drive.readonly scope).
 */
export async function POST(req: NextRequest) {
  try {
    const authService = new AuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { fileId, fileName, mimeType, notebookId } = body;

    if (!fileId || !fileName || !notebookId) {
      return NextResponse.json({ error: 'Missing required fields: fileId, fileName, notebookId' }, { status: 400 });
    }

    // Get Google access token from Supabase session
    const supabase = await createServerClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const providerToken = sessionData?.session?.provider_token;

    if (!providerToken) {
      return NextResponse.json(
        { error: 'Google Drive not connected. Please click "Connect Google Drive" first.' },
        { status: 403 }
      );
    }

    // Fetch knowledge base
    const { data: kb } = await supabase
      .from('knowledge_bases')
      .select('*')
      .eq('id', notebookId)
      .single();

    if (!kb) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
    }

    // Download file from Google Drive API
    // Handle Google Workspace files by exporting them as PDF
    let downloadUrl: string;
    let finalMimeType = mimeType;

    const googleWorkspaceMimeTypes: Record<string, string> = {
      'application/vnd.google-apps.document': 'application/pdf',
      'application/vnd.google-apps.spreadsheet': 'text/csv',
      'application/vnd.google-apps.presentation': 'application/pdf',
    };

    if (googleWorkspaceMimeTypes[mimeType]) {
      const exportMime = googleWorkspaceMimeTypes[mimeType];
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`;
      finalMimeType = exportMime;
    } else {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    }

    const driveResponse = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${providerToken}` },
    });

    if (!driveResponse.ok) {
      const errText = await driveResponse.text();
      throw new Error(`Failed to download from Google Drive: ${errText}`);
    }

    const fileBuffer = Buffer.from(await driveResponse.arrayBuffer());

    // Upload to Supabase storage
    const storageProvider = new SupabaseStorageProvider();
    const storagePath = `${user.id}/${notebookId}/drive_${fileId}_${encodeURIComponent(fileName)}`;
    const { path: filePath } = await storageProvider.uploadFile(storagePath, fileBuffer);

    // Run ingest pipeline
    const observer = new ObservabilityService();
    const pipeline = new DocumentProcessingPipeline(
      storageProvider,
      EmbeddingProviderFactory.create(),
      new SupabaseVectorStore(),
      new SupabaseDocumentRepository(),
      observer
    );

    const document = await pipeline.process(
      user,
      kb,
      filePath,
      fileName,
      finalMimeType,
      fileBuffer.length
    );

    return NextResponse.json({
      success: true,
      document_id: document.id,
      status: document.status,
    });

  } catch (error: any) {
    console.error('Drive import error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error during Drive import' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ingest/import-drive?notebookId=xxx
 * Lists accessible files from the user's Google Drive.
 */
export async function GET(req: NextRequest) {
  try {
    const authService = new AuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServerClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const providerToken = sessionData?.session?.provider_token;

    if (!providerToken) {
      return NextResponse.json({ connected: false, files: [] });
    }

    // Query Drive files (documents, PDFs, spreadsheets, presentations)
    const query = encodeURIComponent(
      "(mimeType='application/pdf' or mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.presentation' or mimeType='text/plain') and trashed=false"
    );

    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,size,modifiedTime)&pageSize=50&orderBy=modifiedTime desc`,
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );

    if (!driveRes.ok) {
      return NextResponse.json({ connected: false, files: [] });
    }

    const { files } = await driveRes.json();
    return NextResponse.json({ connected: true, files: files || [] });

  } catch (error: any) {
    console.error('Drive list error:', error);
    return NextResponse.json({ connected: false, files: [], error: error.message });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/application/services/AuthService';
import { SupabaseStorageProvider } from '@/infrastructure/storage/SupabaseStorageProvider';

export const maxDuration = 60;

/**
 * POST /api/documents/upload
 * Accepts a multipart form with a file and notebookId.
 * Uploads to Supabase Storage and returns the storage path metadata.
 */
export async function POST(req: NextRequest) {
  try {
    const authService = new AuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const notebookId = formData.get('notebookId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!notebookId) {
      return NextResponse.json({ error: 'notebookId is required' }, { status: 400 });
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Build storage path: user_id/notebook_id/filename (timestamped to avoid collisions)
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${user.id}/${notebookId}/${timestamp}_${safeName}`;

    const storageProvider = new SupabaseStorageProvider();
    const { path } = await storageProvider.uploadFile(storagePath, buffer);

    return NextResponse.json({
      filePath: path,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}

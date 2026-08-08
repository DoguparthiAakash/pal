import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/application/services/AuthService';
import { SupabaseDocumentRepository } from '@/infrastructure/repositories/SupabaseDocumentRepository';

const authService = new AuthService();
const documentRepo = new SupabaseDocumentRepository();

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string, docId: string }> }
) {
  try {
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const docId = resolvedParams.docId;
    if (!docId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // Verify ownership
    const doc = await documentRepo.findById(docId);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (doc.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Hard delete the document. The database ON DELETE CASCADE takes care of 
    // chunks, workspace_artifacts, memory_nodes, and memory_edges.
    await documentRepo.delete(docId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete document:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

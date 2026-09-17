import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/infrastructure/auth/server';

/**
 * GET /api/auth/drive-connect
 * Initiates Supabase Google OAuth with Google Drive readonly scope.
 * After OAuth completes, the user's session will contain a Google access token
 * that can be used to access their Drive files.
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const origin = req.nextUrl.origin;
  const notebookId = req.nextUrl.searchParams.get('notebookId') || '';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=/notebooks/${notebookId}/chat&drive=true`,
      scopes: 'openid email profile https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ url: data.url });
}

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/infrastructure/auth/server'
import { AuthenticationError } from '@/config/errors'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Auth Callback] Authorization code received`);
    }
    
    const supabase = await createServerClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Auth Callback] Exchange successful`);
        console.log(`[Auth Callback] Session created for user: ${data.user?.id}`);
        console.log(`[Auth Callback] Redirect completed to: ${origin}${next}`);
      }
      return NextResponse.redirect(`${origin}${next}`)
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.error('[Auth Callback] PKCE Exchange Error:', error.message)
      }
      return NextResponse.redirect(`${origin}/login?error=oauth`)
    }
  }

  // Return the user to an error page with instructions if no code
  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`)
}

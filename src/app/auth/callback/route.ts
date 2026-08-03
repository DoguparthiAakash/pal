import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/infrastructure/auth/server'
import { AuthenticationError } from '@/config/errors'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    } else {
      console.error('PKCE Exchange Error:', error.message)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`)
}

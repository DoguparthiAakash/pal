import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@/infrastructure/auth/server'

export async function middleware(request: NextRequest) {
  const { supabase, supabaseResponse } = createMiddlewareClient(request)

  console.log(`[Middleware] Path: ${request.nextUrl.pathname}`);
  console.log(`[Middleware] Cookies:`, request.cookies.getAll().map(c => c.name));

  // Refresh session if expired
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error) {
    console.error(`[Middleware] getUser error:`, error.message);
  }
  
  console.log(`[Middleware] User:`, user?.id || 'null');

  // Protected routes check
  if (
    !user &&
    request.nextUrl.pathname !== '/' &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/register') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/_next')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from public pages
  if (user && (request.nextUrl.pathname === '/' || request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/register'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }


  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

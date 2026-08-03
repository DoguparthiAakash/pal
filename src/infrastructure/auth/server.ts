import { createServerClient as createSSRClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { config } from '@/config';

export async function createServerClient() {
  const cookieStore = await cookies();

  return createSSRClient(
    config.supabase.url,
    config.supabase.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set({ name, value, ...options });
            });
          } catch (error) {
            // The `set` method was called from a Server Component.
          }
        },
      },
    }
  );
}

import { NextResponse, type NextRequest } from 'next/server';

export function createMiddlewareClient(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  
  const supabase = createSSRClient(
    config.supabase.url,
    config.supabase.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set({ name, value, ...options })
          );
        },
      },
    }
  );
  
  return { supabase, supabaseResponse };
}

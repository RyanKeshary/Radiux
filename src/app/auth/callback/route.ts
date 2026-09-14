import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

/**
 * OAuth Callback Handler
 * 
 * After signing in with Google or GitHub, Supabase redirects the user to this URL
 * with a `code` parameter. We exchange it for a session and redirect to the dashboard.
 * 
 * Also handles password reset redirects (Supabase sends users here with type=recovery).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type'); // 'recovery' for password reset
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(`${origin}/auth-error?message=Supabase+not+configured`);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // For password reset, redirect to a page where the user can set a new password
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/reset-password`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error('[Auth Callback] Error exchanging code for session:', error.message);
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(error.message)}`);
  }

  // No code — redirect to home
  return NextResponse.redirect(`${origin}/`);
}

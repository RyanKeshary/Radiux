import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeOAuthUser } from '@/lib/supabase/profile-utils';

/**
 * OAuth Callback Handler
 * 
 * After signing in with Google or GitHub, Supabase redirects the user to this URL
 * with a `code` parameter. We exchange it for a session, establish cookies,
 * sync the user profile non-destructively, and redirect to destination.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type'); // 'recovery' for password reset
  const next = searchParams.get('next') ?? '/';
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle OAuth provider cancellation or error
  if (errorParam || errorDescription) {
    console.error('[Auth Callback] OAuth Error:', errorParam, errorDescription);
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(errorDescription || errorParam || 'Authentication failed')}`);
  }

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(`${origin}/?auth_error=Supabase+not+configured`);
    }

    const cookieStore = cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Handled when called from server context
          }
        },
      },
    });

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[Auth Callback] Error exchanging code for session:', error.message);
      return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(error.message)}`);
    }

    if (data?.user) {
      // Synchronize profile on server side using safe normalized metadata
      const normalized = normalizeOAuthUser(data.user);

      try {
        // Query existing profile to avoid overwriting user custom edits
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('full_name, display_name, avatar_url, username, bio, github_username')
          .eq('id', data.user.id)
          .maybeSingle();

        const profilePayload: Record<string, any> = {
          id: data.user.id,
          email: data.user.email || '',
          updated_at: new Date().toISOString(),
        };

        if (!existingProfile) {
          // New profile: populate from OAuth metadata
          profilePayload.full_name = normalized.full_name;
          profilePayload.display_name = normalized.display_name;
          profilePayload.avatar_url = normalized.avatar_url;
          profilePayload.username = normalized.username;
          profilePayload.github_username = normalized.github_username;
          profilePayload.bio = '';
          profilePayload.created_at = new Date().toISOString();
        } else {
          // Existing profile: preserve custom values; only backfill if currently empty
          if (!existingProfile.full_name || existingProfile.full_name === 'User' || existingProfile.full_name === 'Radiux User') {
            profilePayload.full_name = normalized.full_name;
          }
          if (!existingProfile.display_name) {
            profilePayload.display_name = normalized.display_name;
          }
          if (!existingProfile.avatar_url && normalized.avatar_url) {
            profilePayload.avatar_url = normalized.avatar_url;
          }
          if (!existingProfile.github_username && normalized.github_username) {
            profilePayload.github_username = normalized.github_username;
          }
        }

        if (!existingProfile) {
          await supabase.from('profiles').insert([profilePayload]);
        } else {
          // Remove ID from update payload to prevent primary key mutability warnings
          const { id, ...updateFields } = profilePayload;
          if (Object.keys(updateFields).length > 1) { // more than just updated_at
            await supabase.from('profiles').update(updateFields).eq('id', data.user.id);
          }
        }
      } catch (profileErr) {
        console.warn('[Auth Callback] Profile sync warning:', profileErr);
      }

      // Password reset redirect
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/reset-password`);
      }

      // Dynamic redirect handling
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';
      const redirectBase = isLocalEnv ? origin : (forwardedHost ? `https://${forwardedHost}` : origin);
      return NextResponse.redirect(`${redirectBase}${next}`);
    }
  }

  // No code provided — redirect to home
  return NextResponse.redirect(`${origin}/`);
}

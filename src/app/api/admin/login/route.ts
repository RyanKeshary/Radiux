import { NextRequest, NextResponse } from 'next/server';
import {
  validateMasterAdmin,
  generateAdminToken,
  ADMIN_CONFIG,
} from '@/lib/admin/admin-auth';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const identifier = (body.identifier || body.email || '').trim();
    const password = (body.password || '').trim();

    if (!identifier || !password) {
      return NextResponse.json({ success: false, notAdmin: true }, { status: 200 });
    }

    // 1. Check Master Admin Credentials
    if (validateMasterAdmin(identifier, password)) {
      const token = generateAdminToken();
      return NextResponse.json({
        success: true,
        isAdmin: true,
        token,
        user: {
          id: 'admin-master-root',
          email: ADMIN_CONFIG.email,
          full_name: 'System Administrator',
          username: ADMIN_CONFIG.defaultUsername,
          role: 'admin',
        },
      });
    }

    // 2. Check if this is an existing Supabase user with role === 'admin'
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (url && anonKey) {
      try {
        const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email: identifier,
          password,
        });

        if (!authErr && authData.session && authData.user) {
          // Check role in profiles
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, full_name, username')
            .eq('id', authData.user.id)
            .maybeSingle();

          if (profile?.role === 'admin') {
            return NextResponse.json({
              success: true,
              isAdmin: true,
              token: authData.session.access_token,
              user: {
                id: authData.user.id,
                email: authData.user.email,
                full_name: profile.full_name || 'Admin',
                username: profile.username || 'admin',
                role: 'admin',
              },
            });
          }
        }
      } catch (e) {}
    }

    // Not an admin credential
    return NextResponse.json({ success: false, notAdmin: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, notAdmin: true }, { status: 200 });
  }
}

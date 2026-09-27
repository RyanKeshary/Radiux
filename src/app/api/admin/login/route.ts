import { NextRequest, NextResponse } from 'next/server';
import {
  validateMasterAdmin,
  generateAdminToken,
  ADMIN_CONFIG,
  isUserAdminEmail,
  isLeadAdminEmail,
  LEAD_ADMIN_EMAIL,
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
      const email = isLeadAdminEmail(identifier) ? LEAD_ADMIN_EMAIL : identifier;
      const isLead = isLeadAdminEmail(email);
      const role = isLead ? 'lead_admin' : 'admin';
      const token = generateAdminToken(email, role);
      return NextResponse.json({
        success: true,
        isAdmin: true,
        isLeadAdmin: isLead,
        token,
        user: {
          id: isLead ? 'admin-lead-root' : 'admin-master-root',
          email,
          full_name: isLead ? 'Ryan Keshary (Lead Admin)' : 'System Administrator',
          username: isLead ? 'ryankeshary' : ADMIN_CONFIG.defaultUsername,
          role,
        },
      });
    }

    // 2. Check if this is an existing Supabase user with admin / lead_admin privileges
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
          const userEmail = authData.user.email?.toLowerCase() || '';
          const isLead = isLeadAdminEmail(userEmail);
          const isEmailAdmin = isUserAdminEmail(userEmail);

          const { data: profile } = await supabase
            .from('profiles')
            .select('role, full_name, username')
            .eq('id', authData.user.id)
            .maybeSingle();

          const isAdmin = isLead || isEmailAdmin || profile?.role === 'admin' || profile?.role === 'lead_admin';

          if (isAdmin) {
            const role = isLead || profile?.role === 'lead_admin' ? 'lead_admin' : 'admin';
            const adminToken = generateAdminToken(authData.user.email, role);
            return NextResponse.json({
              success: true,
              isAdmin: true,
              isLeadAdmin: role === 'lead_admin',
              token: adminToken,
              user: {
                id: authData.user.id,
                email: authData.user.email,
                full_name: profile?.full_name || (isLead ? 'Ryan Keshary' : 'Administrator'),
                username: profile?.username || (isLead ? 'ryankeshary' : 'admin'),
                role,
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

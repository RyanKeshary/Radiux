import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

import { verifyAdminRequest, suspendUserAccount, restoreUserAccount, isUserSuspended, LEAD_ADMIN_EMAIL } from '@/lib/admin/admin-auth';

export async function GET(req: NextRequest) {
  const adminAuth = await verifyAdminRequest(req);
  if (!adminAuth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, email, username, full_name, role, avatar_url, created_at, updated_at, preferences')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const enhanced = (users || []).map((u) => ({
      ...u,
      is_suspended: isUserSuspended(u.id) || !!(u.preferences as any)?.suspended,
    }));

    return NextResponse.json({ users: enhanced });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const adminAuth = await verifyAdminRequest(req);
  if (!adminAuth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action, userId, reason } = body;

    if (!userId || !['suspend', 'restore'].includes(action)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    if (action === 'suspend') {
      await suspendUserAccount(userId, reason || 'Suspended by administrator', adminAuth.email || LEAD_ADMIN_EMAIL);
      return NextResponse.json({ success: true, message: 'User suspended successfully' });
    } else {
      await restoreUserAccount(userId, adminAuth.email || LEAD_ADMIN_EMAIL);
      return NextResponse.json({ success: true, message: 'User account restored successfully' });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const adminAuth = await verifyAdminRequest(req);
  if (!adminAuth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { targetUserId, role } = body;

    if (!targetUserId || !['user', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // Update user profile role
    const { data: updated, error } = await supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', targetUserId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Record in admin audit log
    await supabase.from('admin_audit_logs').insert({
      admin_id: adminAuth.adminId || null,
      action: 'role_change',
      target_id: targetUserId,
      metadata: { new_role: role },
    });

    return NextResponse.json({ user: updated, success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

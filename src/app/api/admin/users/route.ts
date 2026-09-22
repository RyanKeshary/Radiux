import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function verifyAdmin(req: NextRequest, supabase: any): Promise<{ isAdmin: boolean; adminId?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return { isAdmin: false };
  const token = authHeader.replace(/^Bearer\s+/i, '');
  try {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return { isAdmin: false };
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    return { isAdmin: profile?.role === 'admin', adminId: user.id };
  } catch (e) {
    return { isAdmin: false };
  }
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const { isAdmin } = await verifyAdmin(req, supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 });
  }

  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, email, username, full_name, role, avatar_url, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: users || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const { isAdmin, adminId } = await verifyAdmin(req, supabase);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 });
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
      admin_id: adminId,
      action: 'role_change',
      target_id: targetUserId,
      metadata: { new_role: role },
    });

    return NextResponse.json({ user: updated, success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return NextResponse.json({ isAdmin: false, error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ isAdmin: false, error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ isAdmin: false, error: 'Invalid token' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = profile?.role === 'admin';
    return NextResponse.json({
      isAdmin,
      role: profile?.role || 'user',
      userId: user.id,
    });
  } catch (err: any) {
    return NextResponse.json({ isAdmin: false, error: err.message }, { status: 500 });
  }
}

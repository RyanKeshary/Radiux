import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

import { verifyAdminRequest } from '@/lib/admin/admin-auth';

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
    const { data: settings, error } = await supabase
      .from('ai_settings')
      .select('*')
      .order('key', { ascending: true });

    if (error) {
      return NextResponse.json({
        settings: [
          { key: 'groq_model', value: process.env.AI_MODEL || 'openai/gpt-oss-120b', description: 'Primary LLM inference model' },
          { key: 'max_tool_iterations', value: 20, description: 'Maximum iterative tool calls per query' },
          { key: 'agent_permission_mode', value: 'ASSISTED', description: 'Default execution security level' },
          { key: 'telemetry_enabled', value: true, description: 'Collect anonymous usage metrics' },
        ],
      });
    }

    return NextResponse.json({ settings: settings || [] });
  } catch (err: any) {
    return NextResponse.json({ settings: [] });
  }
}

export async function POST(req: NextRequest) {
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
    const { key, value, description } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Missing key or value' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('ai_settings')
      .upsert({
        key,
        value,
        description,
        updated_by: adminAuth.adminId || null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Record audit log
    await supabase.from('admin_audit_logs').insert({
      admin_id: adminAuth.adminId || null,
      action: 'ai_setting_change',
      target_id: key,
      metadata: { new_value: value },
    });

    return NextResponse.json({ setting: updated, success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

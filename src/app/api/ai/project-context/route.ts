import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient(authHeader?: string | null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false },
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  const authHeader = req.headers.get('Authorization');

  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
  }

  const supabase = getSupabaseClient(authHeader);
  if (!supabase) {
    return NextResponse.json({ context: null });
  }

  try {
    const { data, error } = await supabase
      .from('ai_project_context')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ context: null, error: error.message });
    }

    return NextResponse.json({ context: data });
  } catch (err: any) {
    return NextResponse.json({ context: null, error: err.message });
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const supabase = getSupabaseClient(authHeader);

  if (!supabase) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { projectId, framework, language, architecture_summary, coding_conventions, context_data } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('ai_project_context')
      .upsert({
        project_id: projectId,
        framework,
        language,
        architecture_summary,
        coding_conventions,
        context_data: context_data || {},
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ context: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

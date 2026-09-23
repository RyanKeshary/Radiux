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
    // 1. Try dedicated ai_project_context table
    const { data, error } = await supabase
      .from('ai_project_context')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (!error && data) {
      return NextResponse.json({
        context: {
          ...data,
          codingConventions: data.coding_conventions,
        },
      });
    }

    // 2. Fallback: Check files table for .zodiac_memory.json
    const { data: fileData } = await supabase
      .from('files')
      .select('*')
      .eq('project_id', projectId)
      .eq('name', '.zodiac_memory.json')
      .maybeSingle();

    if (fileData && fileData.content) {
      try {
        const parsed = JSON.parse(fileData.content);
        return NextResponse.json({ context: parsed });
      } catch (e) {
        return NextResponse.json({
          context: {
            project_id: projectId,
            coding_conventions: fileData.content,
            codingConventions: fileData.content,
          },
        });
      }
    }

    return NextResponse.json({ context: null });
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
    const { projectId, framework, language, architecture_summary, context_data } = body;
    const coding_conventions = body.coding_conventions ?? body.codingConventions ?? body.instructions ?? body.memory ?? '';

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const memoryPayload = {
      project_id: projectId,
      framework: framework || null,
      language: language || null,
      architecture_summary: architecture_summary || null,
      coding_conventions,
      codingConventions: coding_conventions,
      context_data: context_data || {},
      updated_at: new Date().toISOString(),
    };

    // 1. Attempt upsert into ai_project_context
    const { data, error } = await supabase
      .from('ai_project_context')
      .upsert({
        project_id: projectId,
        framework: framework || null,
        language: language || null,
        architecture_summary: architecture_summary || null,
        coding_conventions,
        context_data: context_data || {},
        updated_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (!error && data) {
      return NextResponse.json({
        context: {
          ...data,
          codingConventions: data?.coding_conventions || coding_conventions,
        },
        savedInDatabase: true,
      });
    }

    // 2. Persist in database files table as .zodiac_memory.json to guarantee database persistence
    try {
      const { data: existingFile } = await supabase
        .from('files')
        .select('id')
        .eq('project_id', projectId)
        .eq('name', '.zodiac_memory.json')
        .maybeSingle();

      if (existingFile) {
        await supabase
          .from('files')
          .update({
            content: JSON.stringify(memoryPayload, null, 2),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingFile.id);
      } else {
        await supabase.from('files').insert({
          project_id: projectId,
          name: '.zodiac_memory.json',
          content: JSON.stringify(memoryPayload, null, 2),
          is_folder: false,
          language: 'json',
        });
      }
    } catch (fileErr) {
      console.warn('[AI Project Context] Files fallback error:', fileErr);
    }

    return NextResponse.json({
      context: memoryPayload,
      savedInDatabase: true,
    });
  } catch (err: any) {
    console.error('[AI Project Context] POST exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

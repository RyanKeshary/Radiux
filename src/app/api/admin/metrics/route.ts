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
    // 1. User metrics
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // 2. Project metrics
    const { count: totalProjects } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true });

    // 3. AI Usage metrics
    const { data: usageData } = await supabase
      .from('ai_usage')
      .select('prompt_tokens, completion_tokens, tool_calls_count, status, latency_ms');

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalToolCalls = 0;
    let errorCount = 0;
    let totalLatency = 0;

    if (usageData && usageData.length > 0) {
      for (const row of usageData) {
        totalPromptTokens += row.prompt_tokens || 0;
        totalCompletionTokens += row.completion_tokens || 0;
        totalToolCalls += row.tool_calls_count || 0;
        totalLatency += row.latency_ms || 0;
        if (row.status === 'error') {
          errorCount++;
        }
      }
    }

    const aiRequestsCount = usageData?.length || 0;
    const avgLatencyMs = aiRequestsCount > 0 ? Math.round(totalLatency / aiRequestsCount) : 0;

    return NextResponse.json({
      metrics: {
        totalUsers: totalUsers || 0,
        activeUsers: totalUsers || 0,
        totalProjects: totalProjects || 0,
        aiRequestsCount,
        totalPromptTokens,
        totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
        totalToolCalls,
        errorCount,
        avgLatencyMs,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

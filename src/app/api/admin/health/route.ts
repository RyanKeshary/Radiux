import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminRequest } from '@/lib/admin/admin-auth';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'ERROR' | 'UNKNOWN';

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  latencyMs: number;
  message: string;
  lastChecked: string;
  details?: Record<string, any>;
}

export async function GET(req: NextRequest) {
  const adminAuth = await verifyAdminRequest(req);
  if (!adminAuth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 });
  }

  const results: Record<string, ComponentHealth> = {};
  const timestamp = new Date().toISOString();

  // 1. Frontend & Next.js Core
  const mem = process.memoryUsage();
  results.frontend = {
    name: 'Frontend Engine (Next.js 14)',
    status: 'HEALTHY',
    latencyMs: 1,
    message: `Uptime: ${Math.round(process.uptime())}s | RSS: ${Math.round(mem.rss / 1024 / 1024)}MB`,
    lastChecked: timestamp,
    details: {
      nodeVersion: process.version,
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
    },
  };

  // 2. WebSocket & Collaboration Backend (Port 1234)
  const wsUrl = process.env.NEXT_PUBLIC_API_URL || 'https://codecollab-backend-isjt.onrender.com';
  const wsStart = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const wsRes = await fetch(`${wsUrl}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    const wsLatency = Date.now() - wsStart;

    if (wsRes.ok) {
      const data = await wsRes.json();
      results.backend_ws = {
        name: 'WebSocket & Terminal Daemon',
        status: wsLatency > 1000 ? 'DEGRADED' : 'HEALTHY',
        latencyMs: wsLatency,
        message: `Connected on ${wsUrl} (${data.service || 'radiux-backend'})`,
        lastChecked: timestamp,
        details: data,
      };
    } else {
      results.backend_ws = {
        name: 'WebSocket & Terminal Daemon',
        status: 'DEGRADED',
        latencyMs: wsLatency,
        message: `HTTP ${wsRes.status} from backend health check`,
        lastChecked: timestamp,
      };
    }
  } catch (err: any) {
    results.backend_ws = {
      name: 'WebSocket & Terminal Daemon',
      status: 'ERROR',
      latencyMs: Date.now() - wsStart,
      message: `Failed to connect to ${wsUrl}: ${err.message || 'Connection refused'}`,
      lastChecked: timestamp,
    };
  }

  // 3. Supabase PostgreSQL & Auth Database
  const dbStart = Date.now();
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('profiles').select('id', { head: true, count: 'exact' });
      const dbLatency = Date.now() - dbStart;
      if (error) {
        results.supabase = {
          name: 'Supabase PostgreSQL Database',
          status: 'DEGRADED',
          latencyMs: dbLatency,
          message: `Query error: ${error.message}`,
          lastChecked: timestamp,
        };
      } else {
        results.supabase = {
          name: 'Supabase PostgreSQL Database',
          status: dbLatency > 1500 ? 'DEGRADED' : 'HEALTHY',
          latencyMs: dbLatency,
          message: `Active & responsive (${dbLatency}ms)`,
          lastChecked: timestamp,
        };
      }
    } catch (e: any) {
      results.supabase = {
        name: 'Supabase PostgreSQL Database',
        status: 'ERROR',
        latencyMs: Date.now() - dbStart,
        message: `Connection exception: ${e.message}`,
        lastChecked: timestamp,
      };
    }
  } else {
    results.supabase = {
      name: 'Supabase PostgreSQL Database',
      status: 'DEGRADED',
      latencyMs: 0,
      message: 'Running in local disk fallback mode (Supabase credentials not configured)',
      lastChecked: timestamp,
    };
  }

  // 4. AI Provider (Groq Zodiac 1.0)
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    results.ai_provider = {
      name: 'Zodiac AI Engine (Groq)',
      status: 'DEGRADED',
      latencyMs: 0,
      message: 'GROQ_API_KEY is not configured in server environment',
      lastChecked: timestamp,
    };
  } else {
    const aiStart = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const groqRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${groqKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const aiLatency = Date.now() - aiStart;
      if (groqRes.ok) {
        results.ai_provider = {
          name: 'Zodiac AI Engine (Groq)',
          status: aiLatency > 2000 ? 'DEGRADED' : 'HEALTHY',
          latencyMs: aiLatency,
          message: `Operational (${process.env.AI_MODEL || 'openai/gpt-oss-20b'})`,
          lastChecked: timestamp,
        };
      } else {
        results.ai_provider = {
          name: 'Zodiac AI Engine (Groq)',
          status: 'ERROR',
          latencyMs: aiLatency,
          message: `Groq API responded with HTTP ${groqRes.status}`,
          lastChecked: timestamp,
        };
      }
    } catch (e: any) {
      results.ai_provider = {
        name: 'Zodiac AI Engine (Groq)',
        status: 'DEGRADED',
        latencyMs: Date.now() - aiStart,
        message: `Health check probe timed out: ${e.message}`,
        lastChecked: timestamp,
      };
    }
  }

  // 5. Terminal Execution Engine
  results.terminal = {
    name: 'PTY Terminal Execution System',
    status: results.backend_ws.status === 'HEALTHY' ? 'HEALTHY' : results.backend_ws.status,
    latencyMs: results.backend_ws.latencyMs,
    message: `Host Platform: ${process.platform} (${process.arch})`,
    lastChecked: timestamp,
  };

  // Determine overall system health
  const statuses = Object.values(results).map((r) => r.status);
  let overall: HealthStatus = 'HEALTHY';
  if (statuses.includes('ERROR')) {
    overall = 'ERROR';
  } else if (statuses.includes('DEGRADED')) {
    overall = 'DEGRADED';
  }

  return NextResponse.json({
    overall,
    components: results,
    services: Object.values(results).map((r) => ({
      name: r.name,
      status: r.status.toLowerCase(),
      latency_ms: r.latencyMs,
      details: r.message,
      last_checked: r.lastChecked,
    })),
    timestamp,
  });
}

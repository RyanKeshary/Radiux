import { NextRequest, NextResponse } from 'next/server';
import { logPerformanceEvent } from '@/lib/analytics/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventName, subsystem, latencyMs, userId, projectId, metadata } = body;

    if (!eventName || !subsystem || latencyMs === undefined) {
      return NextResponse.json({ error: 'eventName, subsystem, and latencyMs are required' }, { status: 400 });
    }

    const perf = await logPerformanceEvent({
      eventName,
      subsystem,
      latencyMs,
      userId,
      projectId,
      metadata,
    });

    return NextResponse.json({ success: true, id: perf.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

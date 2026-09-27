import { NextRequest, NextResponse } from 'next/server';
import { startUserSession, heartbeatUserSession, endUserSession } from '@/lib/analytics/store';

export async function POST(req: NextRequest) {
  try {
    let body: any;
    const text = await req.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = {};
    }

    const { action, userId, projectId, sessionType, sessionId } = body;

    if (action === 'start') {
      const session = await startUserSession({ userId, projectId, sessionType });
      return NextResponse.json({ success: true, sessionId: session.id });
    }

    if (action === 'heartbeat' && sessionId) {
      await heartbeatUserSession(sessionId);
      return NextResponse.json({ success: true });
    }

    if (action === 'end' && sessionId) {
      await endUserSession(sessionId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action or missing sessionId' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

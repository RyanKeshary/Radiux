import { NextRequest, NextResponse } from 'next/server';
import { logAnalyticsEvent } from '@/lib/analytics/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventType = body.eventType || body.event_type;
    const userId = body.userId || body.user_id;
    const projectId = body.projectId || body.project_id;
    const metadata = body.metadata || {};

    if (!eventType) {
      return NextResponse.json({ error: 'eventType (or event_type) is required' }, { status: 400 });
    }

    const event = await logAnalyticsEvent({ eventType, userId, projectId, metadata });
    return NextResponse.json({ success: true, eventId: event.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

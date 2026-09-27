import { NextRequest, NextResponse } from 'next/server';
import { logErrorEvent } from '@/lib/analytics/store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.message;
    const subsystem = body.subsystem;
    const errorType = body.errorType || body.error_type;
    const userId = body.userId || body.user_id;
    const projectId = body.projectId || body.project_id;
    const metadata = body.metadata || {};

    if (!message || !subsystem) {
      return NextResponse.json({ error: 'message and subsystem are required' }, { status: 400 });
    }

    const errRecord = await logErrorEvent({
      message,
      subsystem,
      errorType,
      userId,
      projectId,
      metadata,
    });

    return NextResponse.json({ success: true, id: errRecord.id, signature: errRecord.signature });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

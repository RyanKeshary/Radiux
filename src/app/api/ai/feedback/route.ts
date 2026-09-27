import { NextRequest, NextResponse } from 'next/server';
import { recordFeedback, getFeedbackStats, getAllFeedback } from '@/lib/ai/feedback-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messageId = body.messageId || body.message_id || body.taskId || body.task_id || `msg_${Date.now()}`;
    let type = body.type;
    if (!type && body.rating) {
      type = body.rating === 'positive' ? 'like' : 'dislike';
    }

    if (!messageId || !type) {
      return NextResponse.json(
        { error: 'messageId (or taskId) and type (or rating) are required' },
        { status: 400 }
      );
    }

    if (!['like', 'dislike', 'revert', 'copy'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid feedback type. Must be like, dislike, revert, or copy.' },
        { status: 400 }
      );
    }

    const contentPreview = body.contentPreview || (body.category ? `[${body.category}] ${body.comment || ''}`.trim() : body.comment || '');
    const { filePath, model, userEmail, userName } = body;

    const saved = await recordFeedback({
      messageId,
      type,
      contentPreview,
      filePath,
      model,
      userEmail,
      userName,
    });

    return NextResponse.json({ success: true, item: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const stats = await getFeedbackStats();
    return NextResponse.json({ stats });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

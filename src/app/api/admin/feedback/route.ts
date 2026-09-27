import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin/admin-auth';
import { getFeedbackStats, getAllFeedback } from '@/lib/ai/feedback-store';

export async function GET(req: NextRequest) {
  const adminAuth = await verifyAdminRequest(req);
  if (!adminAuth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 });
  }

  try {
    const stats = await getFeedbackStats();
    const items = getAllFeedback(200);
    return NextResponse.json({ stats, items });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

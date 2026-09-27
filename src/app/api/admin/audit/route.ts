import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getAdminAuditLogsList } from '@/lib/admin/admin-auth';

export async function GET(req: NextRequest) {
  const adminAuth = await verifyAdminRequest(req);
  if (!adminAuth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const search = (searchParams.get('search') || '').trim().toLowerCase();
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)));

  try {
    let logs = await getAdminAuditLogsList(limit);

    if (action) {
      logs = logs.filter((l) => l.action.toLowerCase() === action.toLowerCase());
    }

    if (search) {
      logs = logs.filter(
        (l) =>
          l.action.toLowerCase().includes(search) ||
          l.admin_email?.toLowerCase().includes(search) ||
          l.target_id?.toLowerCase().includes(search) ||
          JSON.stringify(l.metadata || {}).toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      logs,
      total: logs.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

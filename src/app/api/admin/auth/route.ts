import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin/admin-auth';

export async function GET(req: NextRequest) {
  try {
    const adminAuth = await verifyAdminRequest(req);
    if (!adminAuth.isAdmin) {
      return NextResponse.json({ isAdmin: false, error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      isAdmin: true,
      isLeadAdmin: adminAuth.isLeadAdmin,
      role: adminAuth.role,
      userId: adminAuth.userId,
      email: adminAuth.email,
    });
  } catch (err: any) {
    return NextResponse.json({ isAdmin: false, error: err.message }, { status: 500 });
  }
}

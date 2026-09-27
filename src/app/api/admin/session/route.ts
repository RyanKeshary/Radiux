import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, generateAdminToken } from '@/lib/admin/admin-auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.isAdmin) {
      return NextResponse.json({ isAdmin: false, isLeadAdmin: false, role: 'user' });
    }

    const token = generateAdminToken(auth.email, auth.role as 'lead_admin' | 'admin');

    return NextResponse.json({
      isAdmin: true,
      isLeadAdmin: auth.isLeadAdmin,
      role: auth.role,
      token,
      user: {
        id: auth.userId,
        email: auth.email,
        role: auth.role,
        isLeadAdmin: auth.isLeadAdmin,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

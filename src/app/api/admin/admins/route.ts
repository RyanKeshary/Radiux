import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAdminRequest,
  getAdminList,
  addAdmin,
  removeAdmin,
  isLeadAdminEmail,
} from '@/lib/admin/admin-auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 401 });
    }

    const admins = getAdminList();
    return NextResponse.json({
      admins,
      isLeadAdmin: auth.isLeadAdmin,
      callerRole: auth.role,
      callerEmail: auth.email,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 401 });
    }

    if (!auth.isLeadAdmin) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Only the Lead Admin possesses the authority to create or promote new admins.',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const targetEmail = (body.email || '').trim().toLowerCase();
    const targetName = (body.name || '').trim();

    if (!targetEmail || !targetEmail.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required.' }, { status: 400 });
    }

    const result = await addAdmin(targetEmail, targetName, auth.email);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      admin: result.admin,
      admins: getAdminList(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if (!auth.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 401 });
    }

    if (!auth.isLeadAdmin) {
      return NextResponse.json(
        {
          error:
            'Forbidden: Only the Lead Admin possesses the authority to remove or revoke admins.',
        },
        { status: 403 }
      );
    }

    let targetEmail = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();
    if (!targetEmail) {
      try {
        const body = await req.json();
        targetEmail = (body.email || '').trim().toLowerCase();
      } catch (e) {
        // no json body provided
      }
    }

    if (!targetEmail) {
      return NextResponse.json({ error: 'Target email is required.' }, { status: 400 });
    }

    if (isLeadAdminEmail(targetEmail)) {
      return NextResponse.json(
        { error: 'Cannot remove the Lead Admin.' },
        { status: 400 }
      );
    }

    const result = await removeAdmin(targetEmail);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      admins: getAdminList(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

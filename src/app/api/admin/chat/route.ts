import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, logAdminAuditAction } from '@/lib/admin/admin-auth';
import { DataService } from '@/lib/data-service';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const adminAuth = await verifyAdminRequest(req);
  if (!adminAuth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  try {
    // 1. Log workspace chat inspection audit record
    await logAdminAuditAction({
      adminEmail: adminAuth.email,
      action: 'inspect_workspace_chat',
      targetId: projectId,
    });

    // 2. Fetch messages from DataService or disk
    let messages: any[] = [];
    try {
      const diskPath = path.resolve(process.cwd(), '.workspaces', projectId, 'chat.json');
      if (fs.existsSync(diskPath)) {
        messages = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
      }
    } catch {}

    if (messages.length === 0) {
      messages = await DataService.getMessages(projectId);
    }

    return NextResponse.json({
      projectId,
      messages: messages || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const adminAuth = await verifyAdminRequest(req);
  if (!adminAuth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { projectId, message } = body;

    if (!projectId || !message?.trim()) {
      return NextResponse.json({ error: 'projectId and message are required' }, { status: 400 });
    }

    // Always transparently prefix as Admin Announcement — never impersonate another user
    const adminMessage = await DataService.sendMessage(
      projectId,
      'admin-system-id',
      `🛡️ [ADMIN ANNOUNCEMENT] ${adminAuth.email ? `(${adminAuth.email})` : ''}`,
      undefined,
      message.trim()
    );

    await logAdminAuditAction({
      adminEmail: adminAuth.email,
      action: 'send_admin_workspace_message',
      targetId: projectId,
      metadata: { messagePreview: message.slice(0, 100) },
    });

    return NextResponse.json({ success: true, message: adminMessage });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

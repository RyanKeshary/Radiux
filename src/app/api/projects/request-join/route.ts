import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const DATA_ROOT = path.resolve(process.cwd(), '.workspaces', 'data');
const NOTIF_FILE = path.join(DATA_ROOT, 'notifications.json');

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function loadLocalNotifications(): any[] {
  try {
    if (fs.existsSync(NOTIF_FILE)) {
      return JSON.parse(fs.readFileSync(NOTIF_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveLocalNotifications(data: any[]) {
  try {
    if (!fs.existsSync(DATA_ROOT)) {
      fs.mkdirSync(DATA_ROOT, { recursive: true });
    }
    fs.writeFileSync(NOTIF_FILE, JSON.stringify(data.slice(0, 500), null, 2), 'utf8');
  } catch (e) {}
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, requesterId, requesterName, requesterEmail, ownerId: passedOwnerId, projectName: passedProjectName } = body;

    if (!projectId || !requesterId) {
      return NextResponse.json({ error: 'Missing projectId or requesterId' }, { status: 400 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    // 1. Fetch project to identify owner and project name
    const { data: project } = await supabase
      .from('projects')
      .select('id, name, owner_id')
      .eq('id', projectId)
      .maybeSingle();

    const targetOwnerId = project?.owner_id || passedOwnerId;
    const targetProjectName = project?.name || passedProjectName || 'Workspace';

    if (!targetOwnerId) {
      return NextResponse.json({ error: 'Project owner could not be identified' }, { status: 404 });
    }

    if (targetOwnerId === requesterId) {
      return NextResponse.json({ error: 'You are already the owner of this workspace' }, { status: 400 });
    }

    // 2. Check if already a member
    const { data: existingMember } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', requesterId)
      .maybeSingle();

    if (existingMember) {
      return NextResponse.json({ error: 'You are already a member of this project' }, { status: 400 });
    }

    // 3. Create join request notification
    const dedupKey = `join_request:${projectId}:${requesterId}`;
    const name = requesterName || requesterEmail?.split('@')[0] || 'A developer';

    const notif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recipient_id: targetOwnerId,
      actor_id: requesterId,
      actor_name: name,
      project_id: projectId,
      project_name: targetProjectName,
      type: 'action',
      category: 'join_request',
      title: `Join Request: ${targetProjectName}`,
      body: `${name} (${requesterEmail || 'User'}) requested to join "${targetProjectName}" as a collaborator.`,
      metadata: {
        dedup_key: dedupKey,
        requesterId,
        requesterName: name,
        requesterEmail,
        projectId,
        projectName: targetProjectName,
      },
      action_state: 'pending',
      read_at: null,
      created_at: new Date().toISOString(),
    };

    // Try Supabase insert
    try {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('recipient_id', targetOwnerId)
        .eq('metadata->>dedup_key', dedupKey)
        .eq('action_state', 'pending')
        .limit(1);

      if (existing && existing.length > 0) {
        return NextResponse.json({ success: true, message: 'Request already pending' });
      }

      await supabase.from('notifications').insert({
        recipient_id: notif.recipient_id,
        actor_id: notif.actor_id,
        project_id: notif.project_id,
        type: notif.type,
        category: notif.category,
        title: notif.title,
        body: notif.body,
        metadata: notif.metadata,
        action_state: notif.action_state,
      });
    } catch (e) {}

    // Fallback store
    const all = loadLocalNotifications();
    if (!all.some(n => n.recipient_id === notif.recipient_id && n.metadata?.dedup_key === dedupKey && n.action_state === 'pending')) {
      all.unshift(notif);
      saveLocalNotifications(all);
    }

    // Broadcast instant real-time notification to owner
    try {
      const ch = supabase.channel('radiux_notifications_realtime');
      ch.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          ch.send({
            type: 'broadcast',
            event: 'notification',
            payload: notif,
          }).finally(() => {
            setTimeout(() => supabase.removeChannel(ch), 1200);
          });
        }
      });
    } catch (e) {}

    return NextResponse.json({ success: true, notification: notif });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to submit request' }, { status: 500 });
  }
}

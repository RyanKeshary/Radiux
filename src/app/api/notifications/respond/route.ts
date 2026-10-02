import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

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
    const { notification, action } = body; // action: 'accept' | 'decline'

    if (!notification || !action) {
      return NextResponse.json({ error: 'Missing notification or action' }, { status: 400 });
    }

    const newState = action === 'accept' ? 'accepted' : 'declined';
    const readAt = new Date().toISOString();
    const supabase = getSupabase();

    const isProjectInvite = notification.category === 'project_invitation';
    const isJoinRequest = notification.category === 'join_request' || notification.category === 'permission_request';

    // 1. If Action is Accept: mutate membership in database
    if (action === 'accept' && notification.project_id && supabase) {
      const targetUserId = isProjectInvite 
        ? notification.recipient_id 
        : (notification.actor_id || notification.metadata?.requesterId);

      const targetRole = notification.metadata?.role || 'editor';

      if (targetUserId) {
        try {
          // Check if already member
          const { data: existing } = await supabase
            .from('project_members')
            .select('id')
            .eq('project_id', notification.project_id)
            .eq('user_id', targetUserId)
            .maybeSingle();

          if (!existing) {
            // Try inserting desired role
            let res = await supabase.from('project_members').insert({
              project_id: notification.project_id,
              user_id: targetUserId,
              role: targetRole,
            });

            // If check constraint fails (23514), fallback to 'member'
            if (res.error && (res.error.code === '23514' || res.error.message?.includes('check constraint'))) {
              console.warn('[Respond API] Retrying with role "member" due to check constraint');
              await supabase.from('project_members').insert({
                project_id: notification.project_id,
                user_id: targetUserId,
                role: 'member',
              });
            }
          }
        } catch (e) {
          console.error('[Respond API] Error adding member to project:', e);
        }
      }
    }

    // 2. If it was a Join Request, send feedback notification back to requester
    if (isJoinRequest && notification.actor_id) {
      const feedbackNotif = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        recipient_id: notification.actor_id,
        actor_id: notification.recipient_id,
        actor_name: notification.metadata?.ownerName || 'Project Owner',
        project_id: notification.project_id,
        project_name: notification.project_name || notification.metadata?.projectName || 'Workspace',
        type: 'information',
        category: 'project_invitation',
        title: action === 'accept' 
          ? `Join Request Approved: ${notification.project_name || 'Project'}` 
          : `Join Request Declined: ${notification.project_name || 'Project'}`,
        body: action === 'accept'
          ? `Your request to join "${notification.project_name || 'the workspace'}" was accepted! You now have collaborator access.`
          : `Your request to join "${notification.project_name || 'the workspace'}" was declined.`,
        metadata: {
          projectId: notification.project_id,
          projectName: notification.project_name,
        },
        action_state: null,
        read_at: null,
        created_at: new Date().toISOString(),
      };

      if (supabase) {
        try {
          await supabase.from('notifications').insert({
            recipient_id: feedbackNotif.recipient_id,
            actor_id: feedbackNotif.actor_id,
            project_id: feedbackNotif.project_id,
            type: feedbackNotif.type,
            category: feedbackNotif.category,
            title: feedbackNotif.title,
            body: feedbackNotif.body,
            metadata: feedbackNotif.metadata,
          });
        } catch (e) {}
      }

      const all = loadLocalNotifications();
      all.unshift(feedbackNotif);
      saveLocalNotifications(all);
    }

    // 3. Update the notification action state
    if (supabase) {
      try {
        await supabase
          .from('notifications')
          .update({
            action_state: newState,
            read_at: readAt,
          })
          .eq('id', notification.id);
      } catch (e) {}
    }

    // Update server local file
    const all = loadLocalNotifications();
    const item = all.find(n => n.id === notification.id);
    if (item) {
      item.action_state = newState;
      item.read_at = readAt;
      saveLocalNotifications(all);
    }

    return NextResponse.json({ success: true, action_state: newState });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to respond to action' }, { status: 500 });
  }
}

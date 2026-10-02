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

const PARTNERS_FILE = path.join(DATA_ROOT, 'partners.json');

function loadLocalPartners(): any[] {
  try {
    if (fs.existsSync(PARTNERS_FILE)) {
      return JSON.parse(fs.readFileSync(PARTNERS_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveLocalPartners(data: any[]) {
  try {
    if (!fs.existsSync(DATA_ROOT)) {
      fs.mkdirSync(DATA_ROOT, { recursive: true });
    }
    fs.writeFileSync(PARTNERS_FILE, JSON.stringify(data.slice(0, 500), null, 2), 'utf8');
  } catch (e) {}
}

async function broadcastNotification(supabase: any, notif: any) {
  if (!supabase) return;
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
}

async function broadcastUpdate(supabase: any, update: any) {
  if (!supabase) return;
  try {
    const ch = supabase.channel('radiux_notifications_realtime');
    ch.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        ch.send({
          type: 'broadcast',
          event: 'notification_update',
          payload: update,
        }).finally(() => {
          setTimeout(() => supabase.removeChannel(ch), 1200);
        });
      }
    });
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
    const isPartnerRequest = notification.category === 'partner_request';

    // 1. If Action is Accept on Project Invite or Join Request: mutate project_members in database
    if (action === 'accept' && notification.project_id && (isProjectInvite || isJoinRequest)) {
      const targetUserId = isProjectInvite 
        ? notification.recipient_id 
        : (notification.actor_id || notification.metadata?.requesterId);

      const rawRole = notification.metadata?.role || 'member';
      const targetRole = (rawRole === 'editor' || rawRole === 'viewer') ? 'member' : rawRole;

      if (targetUserId && supabase) {
        try {
          const { data: existing } = await supabase
            .from('project_members')
            .select('id')
            .eq('project_id', notification.project_id)
            .eq('user_id', targetUserId)
            .maybeSingle();

          if (!existing) {
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

    // 2. If it was a Partner Request: mutate partner relationship in DB & store
    if (isPartnerRequest) {
      const partnerRequestId = notification.metadata?.partnerRequestId || notification.partner_request_id;
      const partnerStatus = action === 'accept' ? 'accepted' : 'declined';

      if (partnerRequestId && supabase) {
        try {
          await supabase
            .from('coding_partners')
            .update({ status: partnerStatus, updated_at: readAt })
            .eq('id', partnerRequestId);
        } catch (e) {}
      }

      // Also update in server partners store
      const allPartners = loadLocalPartners();
      let matched = false;
      allPartners.forEach((p) => {
        if (
          (partnerRequestId && p.id === partnerRequestId) ||
          (p.requester_id === notification.actor_id && p.receiver_id === notification.recipient_id) ||
          (p.receiver_id === notification.actor_id && p.requester_id === notification.recipient_id)
        ) {
          p.status = partnerStatus;
          p.updated_at = readAt;
          matched = true;
        }
      });
      if (!matched && partnerRequestId) {
        allPartners.push({
          id: partnerRequestId,
          requester_id: notification.actor_id,
          receiver_id: notification.recipient_id,
          status: partnerStatus,
          created_at: notification.created_at,
          updated_at: readAt,
        });
      }
      saveLocalPartners(allPartners);

      // Send Instant Response Notification back to the requester
      if (notification.actor_id) {
        const feedbackNotif = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          recipient_id: notification.actor_id,
          actor_id: notification.recipient_id,
          actor_name: notification.metadata?.receiverName || 'Your peer',
          type: 'information',
          category: 'partner_response',
          title: action === 'accept'
            ? 'Partner Request Accepted!'
            : 'Partner Request Declined',
          body: action === 'accept'
            ? `${notification.metadata?.receiverName || 'Your peer'} accepted your coding partner request! You are now coding partners.`
            : `${notification.metadata?.receiverName || 'Your peer'} declined your coding partner request.`,
          metadata: {
            partnerRequestId,
            responderId: notification.recipient_id,
            action,
          },
          action_state: null,
          read_at: null,
          created_at: new Date().toISOString(),
        };

        if (supabase) {
          try {
            await supabase.from('notifications').insert(feedbackNotif);
          } catch (e) {}
        }

        const all = loadLocalNotifications();
        all.unshift(feedbackNotif);
        saveLocalNotifications(all);

        // Instant Realtime Delivery
        broadcastNotification(supabase, feedbackNotif);
      }
    }

    // 3. If it was a Project Invitation: Send response notification back to the inviter
    if (isProjectInvite && notification.actor_id) {
      const feedbackNotif = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        recipient_id: notification.actor_id,
        actor_id: notification.recipient_id,
        actor_name: notification.metadata?.receiverName || 'Team member',
        project_id: notification.project_id,
        project_name: notification.project_name || 'Workspace',
        type: 'information',
        category: action === 'accept' ? 'collaborator_joined' : 'role_updated',
        title: action === 'accept' 
          ? `Invitation Accepted: ${notification.project_name || 'Workspace'}` 
          : `Invitation Declined: ${notification.project_name || 'Workspace'}`,
        body: action === 'accept'
          ? `${notification.metadata?.receiverName || 'A teammate'} accepted your invitation to collaborate on "${notification.project_name || 'the workspace'}".`
          : `${notification.metadata?.receiverName || 'A teammate'} declined your invitation to join "${notification.project_name || 'the workspace'}".`,
        metadata: {
          projectId: notification.project_id,
          projectName: notification.project_name,
          responderId: notification.recipient_id,
          action,
        },
        action_state: null,
        read_at: null,
        created_at: new Date().toISOString(),
      };

      if (supabase) {
        try {
          await supabase.from('notifications').insert(feedbackNotif);
        } catch (e) {}
      }

      const all = loadLocalNotifications();
      all.unshift(feedbackNotif);
      saveLocalNotifications(all);

      // Instant Realtime Delivery
      broadcastNotification(supabase, feedbackNotif);
    }

    // 4. If it was a Join Request: send response notification back to requester
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
          responderId: notification.recipient_id,
          action,
        },
        action_state: null,
        read_at: null,
        created_at: new Date().toISOString(),
      };

      if (supabase) {
        try {
          await supabase.from('notifications').insert(feedbackNotif);
        } catch (e) {}
      }

      const all = loadLocalNotifications();
      all.unshift(feedbackNotif);
      saveLocalNotifications(all);

      // Instant Realtime Delivery
      broadcastNotification(supabase, feedbackNotif);
    }

    // 5. Update the original notification's action state
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

    const updatedNotification = {
      ...notification,
      action_state: newState,
      read_at: readAt,
    };

    // Broadcast updated state to all clients
    broadcastUpdate(supabase, updatedNotification);

    return NextResponse.json({ success: true, action_state: newState, notification: updatedNotification });
  } catch (err: any) {
    console.error('[Respond API] Error in POST handler:', err);
    return NextResponse.json({ error: err.message || 'Failed to respond to action' }, { status: 500 });
  }
}

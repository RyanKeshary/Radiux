import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const DATA_ROOT = path.resolve(process.cwd(), '.workspaces', 'data');
const DM_FILE = path.join(DATA_ROOT, 'direct_messages.json');

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function loadLocalDMs(): any[] {
  try {
    if (fs.existsSync(DM_FILE)) {
      return JSON.parse(fs.readFileSync(DM_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('[DM API] Error reading local store:', e);
  }
  return [];
}

function saveLocalDMs(data: any[]) {
  try {
    if (!fs.existsSync(DATA_ROOT)) {
      fs.mkdirSync(DATA_ROOT, { recursive: true });
    }
    // Keep up to 3000 DMs
    fs.writeFileSync(DM_FILE, JSON.stringify(data.slice(-3000), null, 2), 'utf8');
  } catch (e) {
    console.error('[DM API] Error saving local store:', e);
  }
}

function getPairKey(user1Id: string, user2Id: string): string {
  return [user1Id, user2Id].sort().join('_');
}

const NOTIF_FILE = path.join(DATA_ROOT, 'notifications.json');

function saveDirectMessageNotification(notif: any) {
  try {
    let notifs: any[] = [];
    if (fs.existsSync(NOTIF_FILE)) {
      notifs = JSON.parse(fs.readFileSync(NOTIF_FILE, 'utf8'));
    }
    notifs.unshift(notif);
    fs.writeFileSync(NOTIF_FILE, JSON.stringify(notifs.slice(0, 500), null, 2), 'utf8');
  } catch (e) {}
}

async function broadcastDM(supabase: any, message: any, senderName?: string) {
  if (!supabase) return;
  const pairKey = getPairKey(message.sender_id, message.receiver_id);
  
  // 1. Broadcast to specific DM room for open chat modals
  try {
    const ch = supabase.channel(`radiux_dm_${pairKey}`);
    ch.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        ch.send({
          type: 'broadcast',
          event: 'dm_message',
          payload: message,
        }).finally(() => {
          setTimeout(() => supabase.removeChannel(ch), 1500);
        });
      }
    });
  } catch (e) {}

  // 2. Broadcast on global notifications channel so recipient receives instant notification & chime anywhere in the app
  try {
    const globalCh = supabase.channel('radiux_notifications_realtime');
    globalCh.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        const notifRecord = {
          id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          recipient_id: message.receiver_id,
          actor_id: message.sender_id,
          actor_name: senderName || 'Developer',
          type: 'information',
          category: 'direct_message',
          title: `Message from ${senderName || 'Developer'}`,
          body: message.content.length > 80 ? message.content.slice(0, 77) + '...' : message.content,
          metadata: {
            id: message.id,
            sender_id: message.sender_id,
            receiver_id: message.receiver_id,
            content: message.content,
            created_at: message.created_at,
            senderId: message.sender_id,
            senderName,
            directMessage: true,
          },
          action_state: null,
          read_at: null,
          created_at: message.created_at,
        };

        saveDirectMessageNotification(notifRecord);

        globalCh.send({
          type: 'broadcast',
          event: 'notification',
          payload: notifRecord,
        }).finally(() => {
          setTimeout(() => supabase.removeChannel(globalCh), 1500);
        });
      }
    });
  } catch (e) {}
}

// GET: fetch chat history between two users
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const user1Id = searchParams.get('user1Id');
  const user2Id = searchParams.get('user2Id');

  if (!user1Id || !user2Id) {
    return NextResponse.json({ error: 'Missing user1Id or user2Id' }, { status: 400 });
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user1Id},receiver_id.eq.${user2Id}),and(sender_id.eq.${user2Id},receiver_id.eq.${user1Id})`
        )
        .order('created_at', { ascending: true })
        .limit(200);

      if (!error && data && data.length > 0) {
        return NextResponse.json({ messages: data });
      }
    } catch (e) {}
  }

  // Fallback to persistent server store
  const all = loadLocalDMs();
  const chatHistory = all
    .filter(
      (m) =>
        (m.sender_id === user1Id && m.receiver_id === user2Id) ||
        (m.sender_id === user2Id && m.receiver_id === user1Id)
    )
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return NextResponse.json({ messages: chatHistory });
}

// POST: send direct message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = body.message || body;

    if (!payload.sender_id || !payload.receiver_id || !payload.content) {
      return NextResponse.json({ error: 'Missing sender_id, receiver_id, or content' }, { status: 400 });
    }

    const newRecord = {
      id: payload.id || `dm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sender_id: payload.sender_id,
      receiver_id: payload.receiver_id,
      content: String(payload.content).trim(),
      read: false,
      created_at: payload.created_at || new Date().toISOString(),
    };

    const senderName = body.sender_name || payload.sender_name;

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('direct_messages')
          .insert({
            id: newRecord.id,
            sender_id: newRecord.sender_id,
            receiver_id: newRecord.receiver_id,
            content: newRecord.content,
            read: false,
            created_at: newRecord.created_at,
          })
          .select()
          .single();

        if (!error && data) {
          broadcastDM(supabase, data, senderName);
          return NextResponse.json({ success: true, message: data });
        }
      } catch (e) {}
    }

    // Save in persistent server store
    const all = loadLocalDMs();
    const existingIdx = all.findIndex((m) => m.id === newRecord.id);
    if (existingIdx !== -1) {
      all[existingIdx] = newRecord;
    } else {
      all.push(newRecord);
    }
    saveLocalDMs(all);

    // Broadcast over realtime
    if (supabase) {
      broadcastDM(supabase, newRecord, senderName);
    }

    return NextResponse.json({ success: true, message: newRecord });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save direct message' }, { status: 500 });
  }
}

// PATCH: mark messages as read
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { senderId, receiverId } = body;

    if (!senderId || !receiverId) {
      return NextResponse.json({ error: 'Missing senderId or receiverId' }, { status: 400 });
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from('direct_messages')
          .update({ read: true })
          .eq('sender_id', senderId)
          .eq('receiver_id', receiverId);
      } catch (e) {}
    }

    const all = loadLocalDMs();
    all.forEach((m) => {
      if (m.sender_id === senderId && m.receiver_id === receiverId) {
        m.read = true;
      }
    });
    saveLocalDMs(all);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to mark read' }, { status: 500 });
  }
}

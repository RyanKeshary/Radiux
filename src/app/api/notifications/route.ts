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
  } catch (e) {
    console.warn('[Notifications API] Error reading local store:', e);
  }
  return [];
}

function saveLocalNotifications(data: any[]) {
  try {
    if (!fs.existsSync(DATA_ROOT)) {
      fs.mkdirSync(DATA_ROOT, { recursive: true });
    }
    fs.writeFileSync(NOTIF_FILE, JSON.stringify(data.slice(0, 500), null, 2), 'utf8');
  } catch (e) {
    console.error('[Notifications API] Error saving local store:', e);
  }
}

// GET: fetch notifications for user
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        return NextResponse.json({ notifications: data });
      }
    } catch (e) {
      // Supabase table does not exist or schema issue
    }
  }

  // Fallback to server local storage
  const all = loadLocalNotifications();
  const userNotifs = all
    .filter((n) => n.recipient_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ notifications: userNotifs });
}

// POST: create a notification
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    if (!payload.recipient_id || !payload.title || !payload.body) {
      return NextResponse.json({ error: 'Missing required notification fields' }, { status: 400 });
    }

    const newRecord = {
      id: payload.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`),
      recipient_id: payload.recipient_id,
      actor_id: payload.actor_id || null,
      actor_name: payload.actor_name || null,
      project_id: payload.project_id || null,
      project_name: payload.project_name || null,
      type: payload.type || 'information',
      category: payload.category || 'system',
      title: payload.title,
      body: payload.body,
      metadata: payload.metadata || {},
      action_state: payload.action_state ?? (payload.type === 'action' ? 'pending' : null),
      read_at: null,
      created_at: payload.created_at || new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .insert({
            recipient_id: newRecord.recipient_id,
            actor_id: newRecord.actor_id,
            project_id: newRecord.project_id,
            type: newRecord.type,
            category: newRecord.category,
            title: newRecord.title,
            body: newRecord.body,
            metadata: newRecord.metadata,
            action_state: newRecord.action_state,
          })
          .select()
          .single();

        if (!error && data) {
          return NextResponse.json({ notification: data });
        }
      } catch (e) {}
    }

    // Save to persistent server store
    const all = loadLocalNotifications();
    // Check deduplication key
    const dedupKey = newRecord.metadata?.dedup_key;
    if (dedupKey && all.some(n => n.recipient_id === newRecord.recipient_id && n.metadata?.dedup_key === dedupKey && n.action_state === 'pending')) {
      return NextResponse.json({ notification: all.find(n => n.recipient_id === newRecord.recipient_id && n.metadata?.dedup_key === dedupKey) });
    }

    all.unshift(newRecord);
    saveLocalNotifications(all);

    return NextResponse.json({ notification: newRecord });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create notification' }, { status: 500 });
  }
}

// PATCH: mark notification as read / mark all as read
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationId, userId, markAll } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const supabase = getSupabase();

    if (supabase) {
      try {
        if (markAll) {
          await supabase
            .from('notifications')
            .update({ read_at: now })
            .eq('recipient_id', userId)
            .is('read_at', null);
        } else if (notificationId) {
          await supabase
            .from('notifications')
            .update({ read_at: now })
            .eq('id', notificationId)
            .eq('recipient_id', userId);
        }
      } catch (e) {}
    }

    // Update server local file
    const all = loadLocalNotifications();
    all.forEach(n => {
      if (n.recipient_id === userId) {
        if (markAll && !n.read_at) {
          n.read_at = now;
        } else if (n.id === notificationId) {
          n.read_at = now;
        }
      }
    });
    saveLocalNotifications(all);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update notification' }, { status: 500 });
  }
}

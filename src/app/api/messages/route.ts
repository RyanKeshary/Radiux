import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const DATA_ROOT = path.resolve(process.cwd(), '.workspaces', 'data');
const MESSAGES_FILE = path.join(DATA_ROOT, 'messages.json');

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function loadLocalMessages(): any[] {
  try {
    if (fs.existsSync(MESSAGES_FILE)) {
      return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('[Messages API] Error reading local store:', e);
  }
  return [];
}

function saveLocalMessages(data: any[]) {
  try {
    if (!fs.existsSync(DATA_ROOT)) {
      fs.mkdirSync(DATA_ROOT, { recursive: true });
    }
    // Keep up to 2000 messages
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(data.slice(-2000), null, 2), 'utf8');
  } catch (e) {
    console.error('[Messages API] Error saving local store:', e);
  }
}

async function broadcastChatMessage(supabase: any, projectId: string, message: any) {
  if (!supabase) return;
  try {
    const ch = supabase.channel(`radiux_chat_${projectId}`);
    ch.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        ch.send({
          type: 'broadcast',
          event: 'chat_message',
          payload: message,
        }).finally(() => {
          setTimeout(() => supabase.removeChannel(ch), 1200);
        });
      }
    });
  } catch (e) {}
}

// GET: fetch chat history for a project
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })
        .limit(200);

      if (!error && data && data.length > 0) {
        return NextResponse.json({ messages: data });
      }
    } catch (e) {}
  }

  // Fallback to persistent server store
  const all = loadLocalMessages();
  const projectMessages = all
    .filter((m) => m.project_id === projectId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return NextResponse.json({ messages: projectMessages });
}

// POST: send a chat message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const messagePayload = body.message || body;

    if (!messagePayload.project_id || !messagePayload.user_id || !messagePayload.content) {
      return NextResponse.json({ error: 'Missing required chat fields' }, { status: 400 });
    }

    const newRecord = {
      id: messagePayload.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      project_id: messagePayload.project_id,
      user_id: messagePayload.user_id,
      user_name: messagePayload.user_name || 'Anonymous',
      user_avatar: messagePayload.user_avatar || '',
      content: String(messagePayload.content).trim(),
      media_type: messagePayload.media_type || null,
      media_url: messagePayload.media_url || null,
      media_name: messagePayload.media_name || null,
      created_at: messagePayload.created_at || new Date().toISOString(),
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('messages')
          .insert({
            id: newRecord.id,
            project_id: newRecord.project_id,
            user_id: newRecord.user_id,
            user_name: newRecord.user_name,
            user_avatar: newRecord.user_avatar,
            content: newRecord.content,
            media_type: newRecord.media_type,
            media_url: newRecord.media_url,
            media_name: newRecord.media_name,
            created_at: newRecord.created_at,
          })
          .select()
          .single();

        if (!error && data) {
          broadcastChatMessage(supabase, newRecord.project_id, data);
          return NextResponse.json({ success: true, message: data });
        }
      } catch (e) {}
    }

    // Save in persistent server store
    const all = loadLocalMessages();
    const existingIdx = all.findIndex((m) => m.id === newRecord.id);
    if (existingIdx !== -1) {
      all[existingIdx] = newRecord;
    } else {
      all.push(newRecord);
    }
    saveLocalMessages(all);

    // Broadcast over realtime
    if (supabase) {
      broadcastChatMessage(supabase, newRecord.project_id, newRecord);
    }

    return NextResponse.json({ success: true, message: newRecord });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save message' }, { status: 500 });
  }
}

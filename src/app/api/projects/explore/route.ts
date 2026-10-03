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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ projects: [] });
  }

  try {
    // 1. Fetch all projects with owner profile
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, name, description, owner_id, created_at, updated_at, owner:profiles!owner_id(id, full_name, display_name, email, avatar_url, username)')
      .order('updated_at', { ascending: false });

    if (error || !projects) {
      return NextResponse.json({ projects: [] });
    }

    // 2. If userId provided, fetch memberships and pending join requests
    const userMemberships = new Set<string>();
    const pendingRequests = new Set<string>();

    if (userId) {
      const { data: memberships } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId);

      if (memberships) {
        memberships.forEach(m => userMemberships.add(m.project_id));
      }

      // Check pending join requests in notifications table or local store
      try {
        const { data: reqs } = await supabase
          .from('notifications')
          .select('project_id')
          .eq('actor_id', userId)
          .in('category', ['join_request', 'permission_request'])
          .eq('action_state', 'pending');

        if (reqs) {
          reqs.forEach(r => r.project_id && pendingRequests.add(r.project_id));
        }
      } catch (e) {
        // Fallback check in local notifications
        const local = loadLocalNotifications();
        local.forEach(n => {
          if (n.actor_id === userId && (n.category === 'join_request' || n.category === 'permission_request') && n.action_state === 'pending' && n.project_id) {
            pendingRequests.add(n.project_id);
          }
        });
      }
    }

    // 3. Transform and tag each project with user status
    const tagged = projects.map((p: any) => {
      const isOwner = userId ? p.owner_id === userId : false;
      const isMember = userId ? userMemberships.has(p.id) : false;
      const isPending = userId ? pendingRequests.has(p.id) : false;

      let status: 'owner' | 'member' | 'pending' | 'can_request' = 'can_request';
      if (isOwner) status = 'owner';
      else if (isMember) status = 'member';
      else if (isPending) status = 'pending';

      const ownerData = Array.isArray(p.owner) ? p.owner[0] : p.owner;

      return {
        id: p.id,
        name: p.name,
        description: p.description || '',
        owner_id: p.owner_id,
        created_at: p.created_at,
        updated_at: p.updated_at,
        owner: ownerData ? {
          id: ownerData.id,
          full_name: ownerData.full_name || ownerData.display_name || 'Developer',
          username: ownerData.username || '',
          email: ownerData.email || '',
          avatar_url: ownerData.avatar_url || '',
        } : null,
        user_status: status,
      };
    });

    return NextResponse.json({ projects: tagged });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load projects' }, { status: 500 });
  }
}

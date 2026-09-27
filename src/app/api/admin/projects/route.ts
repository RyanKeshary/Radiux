import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminRequest, logAdminAuditAction } from '@/lib/admin/admin-auth';
import { getRawAnalyticsState } from '@/lib/analytics/store';
import { StorageMock } from '@/lib/storage-mock';
import fs from 'fs';
import path from 'path';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

const ARCHIVED_PROJECTS_PATH = path.resolve(process.cwd(), '.workspaces', 'data', 'archived_projects.json');

function loadArchivedProjectIds(): string[] {
  try {
    if (fs.existsSync(ARCHIVED_PROJECTS_PATH)) {
      const raw = fs.readFileSync(ARCHIVED_PROJECTS_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveArchivedProjectIds(ids: string[]): void {
  try {
    const dir = path.dirname(ARCHIVED_PROJECTS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ARCHIVED_PROJECTS_PATH, JSON.stringify(ids, null, 2), 'utf8');
  } catch {}
}

export async function GET(req: NextRequest) {
  const adminAuth = await verifyAdminRequest(req);
  if (!adminAuth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get('search') || '').trim().toLowerCase();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
  const filter = searchParams.get('filter') || 'all'; // 'all' | 'active' | 'archived' | 'dormant'

  const supabase = getSupabaseAdmin();
  let projects: any[] = [];
  let profiles: any[] = [];
  let members: any[] = [];
  let files: any[] = [];

  if (supabase) {
    try {
      const [projRes, profRes, memRes, fileRes] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, email, avatar_url, username'),
        supabase.from('project_members').select('id, project_id, user_id, role'),
        supabase.from('files').select('id, project_id, is_folder'),
      ]);

      if (projRes.data) projects = projRes.data;
      if (profRes.data) profiles = profRes.data;
      if (memRes.data) members = memRes.data;
      if (fileRes.data) files = fileRes.data;
    } catch {}
  }

  // Fallback to local mock if DB returns empty
  if (projects.length === 0) {
    projects = StorageMock.getAllProjects();
  }

  const archivedIds = new Set(loadArchivedProjectIds());
  const rawState = getRawAnalyticsState();
  const now = Date.now();
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

  // Enhance project items
  let enriched = projects.map((p) => {
    const owner = profiles.find((prof) => prof.id === p.owner_id);
    const projMembers = members.filter((m) => m.project_id === p.id);
    const projFiles = files.filter((f) => f.project_id === p.id);
    const sessions = rawState.sessions.filter((s) => s.project_id === p.id);
    const isArchived = archivedIds.has(p.id);

    // Activity check
    const lastSession = sessions.length > 0
      ? Math.max(...sessions.map((s) => new Date(s.last_heartbeat || s.started_at).getTime()))
      : new Date(p.updated_at || p.created_at).getTime();

    const isDormant = !isArchived && lastSession < fourteenDaysAgo;
    const isActive = !isArchived && lastSession >= fourteenDaysAgo;

    return {
      id: p.id,
      name: p.name,
      description: p.description || '',
      owner_id: p.owner_id,
      owner_name: owner?.full_name || owner?.username || 'Developer',
      owner_email: owner?.email || '',
      owner_avatar: owner?.avatar_url || '',
      created_at: p.created_at,
      updated_at: p.updated_at,
      member_count: Math.max(1, projMembers.length + (p.owner_id ? 1 : 0)),
      file_count: projFiles.length,
      session_count: sessions.length,
      total_duration_seconds: sessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0),
      last_active_at: new Date(lastSession).toISOString(),
      is_archived: isArchived,
      is_dormant: isDormant,
      is_active: isActive,
    };
  });

  // Filter
  if (search) {
    enriched = enriched.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.description.toLowerCase().includes(search) ||
        p.owner_name.toLowerCase().includes(search) ||
        p.owner_email.toLowerCase().includes(search)
    );
  }

  if (filter === 'active') {
    enriched = enriched.filter((p) => p.is_active);
  } else if (filter === 'archived') {
    enriched = enriched.filter((p) => p.is_archived);
  } else if (filter === 'dormant') {
    enriched = enriched.filter((p) => p.is_dormant);
  }

  const total = enriched.length;
  const startIdx = (page - 1) * limit;
  const paginated = enriched.slice(startIdx, startIdx + limit);

  return NextResponse.json({
    projects: paginated,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    stats: {
      total: projects.length,
      active: enriched.filter((p) => p.is_active).length,
      archived: archivedIds.size,
      dormant: enriched.filter((p) => p.is_dormant).length,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const adminAuth = await verifyAdminRequest(req);
  if (!adminAuth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { projectId, action } = body;

    if (!projectId || !action) {
      return NextResponse.json({ error: 'projectId and action are required' }, { status: 400 });
    }

    const archivedIds = new Set(loadArchivedProjectIds());

    if (action === 'archive') {
      archivedIds.add(projectId);
      saveArchivedProjectIds(Array.from(archivedIds));
      await logAdminAuditAction({
        adminEmail: adminAuth.email,
        action: 'archive_project',
        targetId: projectId,
      });
      return NextResponse.json({ success: true, message: `Project ${projectId} archived.` });
    }

    if (action === 'restore') {
      archivedIds.delete(projectId);
      saveArchivedProjectIds(Array.from(archivedIds));
      await logAdminAuditAction({
        adminEmail: adminAuth.email,
        action: 'restore_project',
        targetId: projectId,
      });
      return NextResponse.json({ success: true, message: `Project ${projectId} restored.` });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const adminAuth = await verifyAdminRequest(req);
  if (!adminAuth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden. Admin privileges required.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId query param required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from('projects').delete().eq('id', projectId);
    }
    StorageMock.deleteProject(projectId);

    await logAdminAuditAction({
      adminEmail: adminAuth.email,
      action: 'delete_project',
      targetId: projectId,
    });

    return NextResponse.json({ success: true, message: `Project ${projectId} permanently deleted.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

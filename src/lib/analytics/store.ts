import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export interface UserSessionRecord {
  id: string;
  user_id: string | null;
  project_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  session_type: string;
  last_heartbeat: string;
}

export interface AnalyticsEventRecord {
  id: string;
  event_type: string;
  user_id: string | null;
  project_id: string | null;
  metadata: Record<string, any>;
  timestamp: string;
}

export interface ReportRecord {
  id: string;
  reporter_id: string | null;
  reporter_email?: string;
  category: 'bug' | 'abuse' | 'inappropriate_content' | 'ai_issue' | 'project_issue' | 'collaboration_issue' | 'security_concern' | 'feature_request' | 'suggestion' | 'other';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  project_id: string | null;
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assigned_admin_id?: string | null;
  resolution?: string | null;
  internal_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ErrorEventRecord {
  id: string;
  signature: string;
  error_type: string;
  message: string;
  subsystem: 'frontend' | 'backend' | 'websocket' | 'ai' | 'terminal' | 'git' | 'database' | 'auth';
  user_id: string | null;
  project_id: string | null;
  metadata: Record<string, any>;
  occurrence_count: number;
  first_seen: string;
  last_seen: string;
  status: 'unresolved' | 'investigating' | 'resolved' | 'ignored';
}

export interface PerformanceEventRecord {
  id: string;
  event_name: string;
  subsystem: 'api' | 'websocket' | 'ai' | 'tool' | 'terminal' | 'project_load' | 'editor_init';
  latency_ms: number;
  user_id: string | null;
  project_id: string | null;
  metadata: Record<string, any>;
  timestamp: string;
}

export interface AnnouncementRecord {
  id: string;
  title: string;
  content: string;
  level: 'info' | 'warning' | 'critical' | 'maintenance';
  is_active: boolean;
  created_by?: string;
  created_at: string;
  expires_at?: string;
}

// In-memory global store with disk persistence for permanent reliability
interface AnalyticsGlobalState {
  sessions: UserSessionRecord[];
  events: AnalyticsEventRecord[];
  reports: ReportRecord[];
  errors: ErrorEventRecord[];
  performance: PerformanceEventRecord[];
  announcements: AnnouncementRecord[];
}

const ANALYTICS_DISK_PATH = path.resolve(process.cwd(), '.workspaces', 'data', 'analytics_state.json');

function loadAnalyticsDisk(): AnalyticsGlobalState | null {
  try {
    if (fs.existsSync(ANALYTICS_DISK_PATH)) {
      const raw = fs.readFileSync(ANALYTICS_DISK_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
          events: Array.isArray(parsed.events) ? parsed.events : [],
          reports: Array.isArray(parsed.reports) ? parsed.reports : [],
          errors: Array.isArray(parsed.errors) ? parsed.errors : [],
          performance: Array.isArray(parsed.performance) ? parsed.performance : [],
          announcements: Array.isArray(parsed.announcements) ? parsed.announcements : [],
        };
      }
    }
  } catch {}
  return null;
}

export function saveAnalyticsDisk(): void {
  try {
    const dir = path.dirname(ANALYTICS_DISK_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (g.__radiux_analytics_state) {
      fs.writeFileSync(
        ANALYTICS_DISK_PATH,
        JSON.stringify(
          {
            sessions: g.__radiux_analytics_state.sessions.slice(0, 1000),
            events: g.__radiux_analytics_state.events.slice(0, 2000),
            reports: g.__radiux_analytics_state.reports.slice(0, 500),
            errors: g.__radiux_analytics_state.errors.slice(0, 500),
            performance: g.__radiux_analytics_state.performance.slice(0, 1000),
            announcements: g.__radiux_analytics_state.announcements.slice(0, 50),
          },
          null,
          2
        ),
        'utf8'
      );
    }
  } catch {}
}

const g = globalThis as unknown as { __radiux_analytics_state?: AnalyticsGlobalState };

if (!g.__radiux_analytics_state) {
  const diskState = loadAnalyticsDisk();
  g.__radiux_analytics_state = diskState || {
    sessions: [],
    events: [],
    reports: [],
    errors: [],
    performance: [],
    announcements: [
      {
        id: 'ann-init-1',
        title: 'Welcome to Radiux Console Intelligence',
        content: 'Platform telemetry, session analytics, and error tracking are now live.',
        level: 'info',
        is_active: true,
        created_by: 'system',
        created_at: new Date().toISOString(),
      },
    ],
  };
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// ==========================================
// 1. Session Operations
// ==========================================
export async function startUserSession(payload: {
  userId?: string | null;
  projectId?: string | null;
  sessionType?: string;
}): Promise<UserSessionRecord> {
  const session: UserSessionRecord = {
    id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    user_id: payload.userId || null,
    project_id: payload.projectId || null,
    started_at: new Date().toISOString(),
    ended_at: null,
    duration_seconds: 0,
    session_type: payload.sessionType || 'ide_workspace',
    last_heartbeat: new Date().toISOString(),
  };

  g.__radiux_analytics_state!.sessions.unshift(session);
  if (g.__radiux_analytics_state!.sessions.length > 2000) {
    g.__radiux_analytics_state!.sessions = g.__radiux_analytics_state!.sessions.slice(0, 2000);
  }

  // Also log canonical event: session.started
  await logAnalyticsEvent({
    eventType: 'session.started',
    userId: session.user_id,
    projectId: session.project_id,
    metadata: { sessionId: session.id, sessionType: session.session_type },
  });

  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from('user_sessions').insert(session);
    }
  } catch (e) {}

  return session;
}

export async function heartbeatUserSession(sessionId: string): Promise<boolean> {
  const session = g.__radiux_analytics_state!.sessions.find((s) => s.id === sessionId);
  if (!session) return false;

  const now = new Date();
  const started = new Date(session.started_at);
  session.last_heartbeat = now.toISOString();
  session.duration_seconds = Math.max(0, Math.floor((now.getTime() - started.getTime()) / 1000));

  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase
        .from('user_sessions')
        .update({
          last_heartbeat: session.last_heartbeat,
          duration_seconds: session.duration_seconds,
        })
        .eq('id', sessionId);
    }
  } catch (e) {}

  return true;
}

export async function endUserSession(sessionId: string): Promise<boolean> {
  const session = g.__radiux_analytics_state!.sessions.find((s) => s.id === sessionId);
  if (!session) return false;

  const now = new Date();
  const started = new Date(session.started_at);
  session.ended_at = now.toISOString();
  session.last_heartbeat = now.toISOString();
  session.duration_seconds = Math.max(0, Math.floor((now.getTime() - started.getTime()) / 1000));

  await logAnalyticsEvent({
    eventType: 'session.ended',
    userId: session.user_id,
    projectId: session.project_id,
    metadata: { sessionId: session.id, duration_seconds: session.duration_seconds },
  });

  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase
        .from('user_sessions')
        .update({
          ended_at: session.ended_at,
          duration_seconds: session.duration_seconds,
          last_heartbeat: session.last_heartbeat,
        })
        .eq('id', sessionId);
    }
  } catch (e) {}

  return true;
}

// ==========================================
// 2. Canonical Events Ingestion
// ==========================================
export async function logAnalyticsEvent(payload: {
  eventType: string;
  userId?: string | null;
  projectId?: string | null;
  metadata?: Record<string, any>;
}): Promise<AnalyticsEventRecord> {
  const event: AnalyticsEventRecord = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    event_type: payload.eventType,
    user_id: payload.userId || null,
    project_id: payload.projectId || null,
    metadata: payload.metadata || {},
    timestamp: new Date().toISOString(),
  };

  g.__radiux_analytics_state!.events.unshift(event);
  if (g.__radiux_analytics_state!.events.length > 5000) {
    g.__radiux_analytics_state!.events = g.__radiux_analytics_state!.events.slice(0, 5000);
  }

  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from('analytics_events').insert(event);
    }
  } catch (e) {}

  return event;
}

// ==========================================
// 3. Error Telemetry Ingestion
// ==========================================
export async function logErrorEvent(payload: {
  message: string;
  errorType?: string;
  subsystem: ErrorEventRecord['subsystem'];
  userId?: string | null;
  projectId?: string | null;
  metadata?: Record<string, any>;
}): Promise<ErrorEventRecord> {
  const signature = `${payload.subsystem}:${payload.errorType || 'Error'}:${payload.message.slice(0, 80)}`;
  const existing = g.__radiux_analytics_state!.errors.find((e) => e.signature === signature);

  if (existing) {
    existing.occurrence_count += 1;
    existing.last_seen = new Date().toISOString();
    existing.metadata = { ...existing.metadata, ...payload.metadata };
    return existing;
  }

  const newError: ErrorEventRecord = {
    id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    signature,
    error_type: payload.errorType || 'Error',
    message: payload.message,
    subsystem: payload.subsystem,
    user_id: payload.userId || null,
    project_id: payload.projectId || null,
    metadata: payload.metadata || {},
    occurrence_count: 1,
    first_seen: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    status: 'unresolved',
  };

  g.__radiux_analytics_state!.errors.unshift(newError);
  if (g.__radiux_analytics_state!.errors.length > 1000) {
    g.__radiux_analytics_state!.errors = g.__radiux_analytics_state!.errors.slice(0, 1000);
  }

  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from('error_events').insert(newError);
    }
  } catch (e) {}

  return newError;
}

// ==========================================
// 4. Performance Telemetry Ingestion
// ==========================================
export async function logPerformanceEvent(payload: {
  eventName: string;
  subsystem: PerformanceEventRecord['subsystem'];
  latencyMs: number;
  userId?: string | null;
  projectId?: string | null;
  metadata?: Record<string, any>;
}): Promise<PerformanceEventRecord> {
  const perf: PerformanceEventRecord = {
    id: `perf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    event_name: payload.eventName,
    subsystem: payload.subsystem,
    latency_ms: Math.round(payload.latencyMs),
    user_id: payload.userId || null,
    project_id: payload.projectId || null,
    metadata: payload.metadata || {},
    timestamp: new Date().toISOString(),
  };

  g.__radiux_analytics_state!.performance.unshift(perf);
  if (g.__radiux_analytics_state!.performance.length > 2000) {
    g.__radiux_analytics_state!.performance = g.__radiux_analytics_state!.performance.slice(0, 2000);
  }

  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from('performance_events').insert(perf);
    }
  } catch (e) {}

  return perf;
}

// ==========================================
// 5. Reports & Complaints
// ==========================================
export async function createReport(payload: {
  reporterId?: string | null;
  reporterEmail?: string;
  category: ReportRecord['category'];
  severity?: ReportRecord['severity'];
  title: string;
  description: string;
  projectId?: string | null;
  priority?: ReportRecord['priority'];
}): Promise<ReportRecord> {
  const report: ReportRecord = {
    id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    reporter_id: payload.reporterId || null,
    reporter_email: payload.reporterEmail,
    category: payload.category,
    severity: payload.severity || (payload.category === 'security_concern' ? 'HIGH' : 'MEDIUM'),
    title: payload.title,
    description: payload.description,
    project_id: payload.projectId || null,
    status: 'OPEN',
    priority: payload.priority || (payload.category === 'security_concern' ? 'HIGH' : 'MEDIUM'),
    assigned_admin_id: null,
    resolution: null,
    internal_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  g.__radiux_analytics_state!.reports.unshift(report);

  await logAnalyticsEvent({
    eventType: 'report.created',
    userId: report.reporter_id,
    projectId: report.project_id,
    metadata: { reportId: report.id, category: report.category, severity: report.severity },
  });

  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from('reports_and_complaints').insert(report);
    }
  } catch (e) {}

  saveAnalyticsDisk();
  return report;
}

export async function updateReport(
  reportId: string,
  updates: Partial<Pick<ReportRecord, 'status' | 'priority' | 'assigned_admin_id' | 'resolution' | 'internal_notes'>>
): Promise<ReportRecord | null> {
  const report = g.__radiux_analytics_state!.reports.find((r) => r.id === reportId);
  if (!report) return null;

  Object.assign(report, updates, { updated_at: new Date().toISOString() });

  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from('reports_and_complaints').update(updates).eq('id', reportId);
    }
  } catch (e) {}

  saveAnalyticsDisk();
  return report;
}

// ==========================================
// 6. Announcements Management
// ==========================================
export async function createAnnouncement(payload: {
  title: string;
  content: string;
  level?: AnnouncementRecord['level'];
  createdBy?: string;
  expiresAt?: string;
}): Promise<AnnouncementRecord> {
  const announcement: AnnouncementRecord = {
    id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: payload.title,
    content: payload.content,
    level: payload.level || 'info',
    is_active: true,
    created_by: payload.createdBy || 'admin',
    created_at: new Date().toISOString(),
    expires_at: payload.expiresAt,
  };

  g.__radiux_analytics_state!.announcements.unshift(announcement);

  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from('system_announcements').insert(announcement);
    }
  } catch (e) {}

  saveAnalyticsDisk();
  return announcement;
}

export async function toggleAnnouncement(id: string, is_active: boolean): Promise<boolean> {
  const ann = g.__radiux_analytics_state!.announcements.find((a) => a.id === id);
  if (!ann) return false;
  ann.is_active = is_active;
  saveAnalyticsDisk();
  return true;
}

// ==========================================
// 7. Getters for Raw Analytics Records
// ==========================================
export function getRawAnalyticsState() {
  return g.__radiux_analytics_state!;
}

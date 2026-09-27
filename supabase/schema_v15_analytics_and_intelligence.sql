-- ==============================================================================
-- Schema Migration v15: Radiux Full Product Intelligence & Analytics Console
-- Description: Canonical analytics events, session tracking, reports & complaints,
--              error events, performance telemetry, and system announcements.
-- ==============================================================================

-- 1. User Sessions Table (Tracks genuine developer usage, not idle browser tabs)
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  started_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  ended_at timestamp with time zone,
  duration_seconds integer DEFAULT 0 NOT NULL,
  session_type text DEFAULT 'ide_workspace' NOT NULL,
  last_heartbeat timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  ip_hash text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_project ON user_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_started ON user_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_heartbeat ON user_sessions(last_heartbeat DESC);

-- 2. Canonical Analytics Events Table
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  timestamp timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_project ON analytics_events(project_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp DESC);

-- 3. Reports & Complaints Table
CREATE TABLE IF NOT EXISTS reports_and_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_email text,
  category text NOT NULL CHECK (category IN (
    'bug', 'abuse', 'inappropriate_content', 'ai_issue', 'project_issue',
    'collaboration_issue', 'security_concern', 'feature_request', 'suggestion', 'other'
  )),
  severity text NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  title text NOT NULL,
  description text NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED')),
  priority text NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  assigned_admin_id text,
  resolution text,
  internal_notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports_and_complaints(status);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports_and_complaints(category);
CREATE INDEX IF NOT EXISTS idx_reports_severity ON reports_and_complaints(severity);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports_and_complaints(created_at DESC);

-- 4. Error Events & Reliability Table
CREATE TABLE IF NOT EXISTS error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signature text NOT NULL,
  error_type text NOT NULL,
  message text NOT NULL,
  subsystem text NOT NULL CHECK (subsystem IN (
    'frontend', 'backend', 'websocket', 'ai', 'terminal', 'git', 'database', 'auth'
  )),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  occurrence_count integer DEFAULT 1 NOT NULL,
  first_seen timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_seen timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  status text DEFAULT 'unresolved' CHECK (status IN ('unresolved', 'investigating', 'resolved', 'ignored'))
);

CREATE INDEX IF NOT EXISTS idx_error_events_subsystem ON error_events(subsystem);
CREATE INDEX IF NOT EXISTS idx_error_events_signature ON error_events(signature);
CREATE INDEX IF NOT EXISTS idx_error_events_last_seen ON error_events(last_seen DESC);

-- 5. Performance Telemetry Table
CREATE TABLE IF NOT EXISTS performance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  subsystem text NOT NULL CHECK (subsystem IN (
    'api', 'websocket', 'ai', 'tool', 'terminal', 'project_load', 'editor_init'
  )),
  latency_ms integer NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  timestamp timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_performance_events_subsystem ON performance_events(subsystem);
CREATE INDEX IF NOT EXISTS idx_performance_events_timestamp ON performance_events(timestamp DESC);

-- 6. System Announcements Table
CREATE TABLE IF NOT EXISTS system_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'critical', 'maintenance')),
  is_active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON system_announcements(is_active);

-- Enable Row Level Security (RLS)
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports_and_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_announcements ENABLE ROW LEVEL SECURITY;

-- Admins have unrestricted access to all analytics and operational tables
CREATE POLICY admin_all_user_sessions ON user_sessions FOR ALL TO authenticated USING (is_admin());
CREATE POLICY admin_all_analytics_events ON analytics_events FOR ALL TO authenticated USING (is_admin());
CREATE POLICY admin_all_reports ON reports_and_complaints FOR ALL TO authenticated USING (is_admin());
CREATE POLICY admin_all_error_events ON error_events FOR ALL TO authenticated USING (is_admin());
CREATE POLICY admin_all_performance ON performance_events FOR ALL TO authenticated USING (is_admin());
CREATE POLICY admin_all_announcements ON system_announcements FOR ALL TO authenticated USING (is_admin());

-- Regular authenticated users can submit their own sessions, events, and reports
CREATE POLICY user_insert_sessions ON user_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_update_own_sessions ON user_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY user_insert_events ON analytics_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY user_insert_reports ON reports_and_complaints FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id OR reporter_id IS NULL);
CREATE POLICY public_read_announcements ON system_announcements FOR SELECT TO authenticated USING (is_active = true);

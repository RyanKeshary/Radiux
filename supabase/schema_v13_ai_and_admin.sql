-- ==============================================================================
-- Schema Migration v13: Radiux AI Coding Agent & Admin Panel
-- Description: AI conversations, messages, usage analytics, project memory,
--              global AI settings, admin audit logs, and profile roles with strict RLS.
-- ==============================================================================

-- 1. Ensure user profile role column exists with safe default and check constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role text NOT NULL DEFAULT 'user';
  END IF;
END $$;

-- Role constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_profile_role;
ALTER TABLE profiles ADD CONSTRAINT check_profile_role CHECK (role IN ('user', 'admin'));

-- Index on profiles role for fast admin lookup
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Helper function to check if current authenticated user is an admin
CREATE OR REPLACE FUNCTION is_admin() 
RETURNS boolean 
LANGUAGE sql 
SECURITY DEFINER 
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 2. AI Conversations Table
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Conversation',
  permission_mode text NOT NULL DEFAULT 'ASSISTED' CHECK (permission_mode IN ('READ_ONLY', 'ASSISTED', 'AUTONOMOUS')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_project ON ai_conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated ON ai_conversations(updated_at DESC);

-- 3. AI Messages Table
CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content text,
  tool_calls jsonb,
  tool_results jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created ON ai_messages(created_at ASC);

-- 4. AI Usage Tracking Table (Cost & Quota control)
CREATE TABLE IF NOT EXISTS ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  model text NOT NULL,
  prompt_tokens integer DEFAULT 0 NOT NULL,
  completion_tokens integer DEFAULT 0 NOT NULL,
  total_tokens integer GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  latency_ms integer DEFAULT 0 NOT NULL,
  tool_calls_count integer DEFAULT 0 NOT NULL,
  status text DEFAULT 'success' NOT NULL,
  error_message text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_project ON ai_usage(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_model ON ai_usage(model);

-- 5. AI Project Context / Memory Table
CREATE TABLE IF NOT EXISTS ai_project_context (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  framework text,
  language text,
  architecture_summary text,
  coding_conventions text,
  context_data jsonb DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Global AI Configuration & Settings Table (Admin configurable)
CREATE TABLE IF NOT EXISTS ai_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed default AI settings if not present
INSERT INTO ai_settings (key, value, description)
VALUES 
  ('default_model', '"llama-3.3-70b-versatile"'::jsonb, 'Default Groq model for AI agent tasks'),
  ('max_agent_steps', '20'::jsonb, 'Maximum iterative tool calls per agent invocation'),
  ('max_context_tokens', '128000'::jsonb, 'Maximum context token budget'),
  ('max_output_tokens', '8192'::jsonb, 'Maximum completion output tokens'),
  ('default_permission_mode', '"ASSISTED"'::jsonb, 'Default security permission mode for new sessions'),
  ('rate_limit_per_minute', '30'::jsonb, 'Maximum AI agent requests per user per minute')
ON CONFLICT (key) DO NOTHING;

-- 7. Admin Audit Logs Table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);

-- ==============================================================================
-- Row-Level Security (RLS) Policies
-- ==============================================================================

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_project_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- AI Conversations Policies
CREATE POLICY "Users can view their own AI conversations"
  ON ai_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own AI conversations"
  ON ai_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI conversations"
  ON ai_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AI conversations"
  ON ai_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- AI Messages Policies
CREATE POLICY "Users can view messages in their conversations"
  ON ai_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ai_conversations c 
      WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages into their conversations"
  ON ai_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_conversations c 
      WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages in their conversations"
  ON ai_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM ai_conversations c 
      WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()
    )
  );

-- AI Project Context Policies (Project members can view and update)
CREATE POLICY "Project members can view AI project context"
  ON ai_project_context FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p 
      WHERE p.id = ai_project_context.project_id AND (
        p.owner_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Project members can insert or update AI project context"
  ON ai_project_context FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects p 
      WHERE p.id = ai_project_context.project_id AND (
        p.owner_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = auth.uid())
      )
    )
  );

-- AI Usage Policies: Users can view their own usage; Admins can view all usage
CREATE POLICY "Users can view their own AI usage"
  ON ai_usage FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Authenticated users or server can insert AI usage"
  ON ai_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id OR is_admin());

-- AI Settings Policies: Everyone can read; Only Admins can modify
CREATE POLICY "Anyone can read AI settings"
  ON ai_settings FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify AI settings"
  ON ai_settings FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Admin Audit Logs Policies: Only Admins can view and write
CREATE POLICY "Only admins can view audit logs"
  ON admin_audit_logs FOR SELECT
  USING (is_admin());

CREATE POLICY "Only admins can insert audit logs"
  ON admin_audit_logs FOR INSERT
  WITH CHECK (is_admin());

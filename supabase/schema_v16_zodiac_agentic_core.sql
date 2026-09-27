-- ==============================================================================
-- Schema Migration v16: Zodiac 1.0 Agentic AI Core
-- Description: Adds tables for ai_tasks, ai_tool_calls, and ai_feedback with
--              strict project-level and user-level RLS policies and indexes.
-- ==============================================================================

-- 1. AI Tasks Table (Tracks multi-step agent execution state)
CREATE TABLE IF NOT EXISTS ai_tasks (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES ai_conversations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'PLANNING' CHECK (
    status IN (
      'QUEUED',
      'PLANNING',
      'RUNNING',
      'WAITING_FOR_APPROVAL',
      'VALIDATING',
      'COMPLETED',
      'FAILED',
      'CANCELLED',
      'MAX_STEPS_REACHED'
    )
  ),
  mode text NOT NULL DEFAULT 'ASSISTED' CHECK (mode IN ('READ_ONLY', 'ASSISTED', 'AUTONOMOUS')),
  intent_mode text NOT NULL DEFAULT 'AGENT' CHECK (
    intent_mode IN ('ASK', 'EXPLAIN', 'EDIT', 'DEBUG', 'BUILD', 'TEST', 'REVIEW', 'AGENT')
  ),
  goal text NOT NULL,
  current_step integer DEFAULT 0 NOT NULL,
  max_steps integer DEFAULT 30 NOT NULL,
  plan jsonb DEFAULT '[]'::jsonb,
  files_inspected jsonb DEFAULT '[]'::jsonb,
  files_modified jsonb DEFAULT '[]'::jsonb,
  commands_run jsonb DEFAULT '[]'::jsonb,
  validation_results jsonb DEFAULT '[]'::jsonb,
  started_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_project ON ai_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_user ON ai_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON ai_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_started ON ai_tasks(started_at DESC);

-- Enable RLS on ai_tasks
ALTER TABLE ai_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks in their projects"
ON ai_tasks FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  project_id IN (
    SELECT p.id FROM projects p WHERE p.owner_id = auth.uid()
    UNION
    SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
  ) OR
  is_admin()
);

CREATE POLICY "Users can create tasks for their projects"
ON ai_tasks FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() OR
  project_id IN (
    SELECT p.id FROM projects p WHERE p.owner_id = auth.uid()
    UNION
    SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their tasks"
ON ai_tasks FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR
  project_id IN (
    SELECT p.id FROM projects p WHERE p.owner_id = auth.uid()
  ) OR
  is_admin()
);

-- 2. AI Tool Calls Table (Structured execution metadata)
CREATE TABLE IF NOT EXISTS ai_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL REFERENCES ai_tasks(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  args jsonb DEFAULT '{}'::jsonb,
  output text,
  error text,
  duration_ms integer DEFAULT 0 NOT NULL,
  status text DEFAULT 'success' NOT NULL CHECK (status IN ('success', 'failed', 'blocked')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_task ON ai_tool_calls(task_id);
CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_tool ON ai_tool_calls(tool_name);
CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_created ON ai_tool_calls(created_at DESC);

-- Enable RLS on ai_tool_calls
ALTER TABLE ai_tool_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tool calls for their tasks"
ON ai_tool_calls FOR SELECT
TO authenticated
USING (
  task_id IN (
    SELECT id FROM ai_tasks WHERE user_id = auth.uid() OR project_id IN (
      SELECT p.id FROM projects p WHERE p.owner_id = auth.uid()
      UNION
      SELECT pm.project_id FROM project_members pm WHERE pm.user_id = auth.uid()
    )
  ) OR
  is_admin()
);

CREATE POLICY "Users can insert tool calls for their tasks"
ON ai_tool_calls FOR INSERT
TO authenticated
WITH CHECK (
  task_id IN (
    SELECT id FROM ai_tasks WHERE user_id = auth.uid()
  )
);

-- 3. AI Feedback Table (User satisfaction, bug reports on AI output)
CREATE TABLE IF NOT EXISTS ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text REFERENCES ai_tasks(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES ai_conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES ai_messages(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating text NOT NULL CHECK (rating IN ('thumbs_up', 'thumbs_down')),
  category text,
  comment text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_task ON ai_feedback(task_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_user ON ai_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_created ON ai_feedback(created_at DESC);

-- Enable RLS on ai_feedback
ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback or admin view all"
ON ai_feedback FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can insert their own feedback"
ON ai_feedback FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

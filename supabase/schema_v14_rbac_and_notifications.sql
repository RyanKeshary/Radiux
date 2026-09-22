-- ==============================================================================
-- Migration v14: Workspace RBAC Roles & Rebuilt Notification Subsystem
-- ==============================================================================
-- 1. Updates project_members.role check constraint to support:
--    'owner', 'editor', 'visitor', and legacy 'member'.
-- 2. Rebuilds public.notifications table from scratch with a clean,
--    event-driven schema, actionable state handling, and strict RLS.
-- ==============================================================================

-- 1. RBAC Roles in project_members
DO $$
BEGIN
  -- Drop existing role check constraint if present
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'project_members' AND constraint_name = 'project_members_role_check'
  ) THEN
    ALTER TABLE public.project_members DROP CONSTRAINT project_members_role_check;
  END IF;

  -- Add updated constraint permitting 'owner', 'editor', 'visitor', 'member'
  ALTER TABLE public.project_members 
    ADD CONSTRAINT project_members_role_check 
    CHECK (role IN ('owner', 'editor', 'visitor', 'member'));
END $$;


-- 2. Clean Rebuilt Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'action' | 'information' | 'collaboration'
  category VARCHAR(50) NOT NULL, -- 'project_invitation' | 'review_request' | 'permission_request' | 'deployment' | 'system' | 'collaborator_joined'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  action_state VARCHAR(20) DEFAULT NULL, -- 'pending' | 'accepted' | 'declined' | 'dismissed' (or null if purely informational)
  read_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indices for rapid querying and deduplication checks
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread 
  ON public.notifications (recipient_id, read_at);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created 
  ON public.notifications (recipient_id, created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies if any exist
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

-- Strict RLS Policies:
-- 1. Users can only select their own notifications
CREATE POLICY "Users can view own notifications" 
  ON public.notifications 
  FOR SELECT 
  USING (auth.uid() = recipient_id);

-- 2. Users can only update their own notifications (e.g. mark read, accept/decline action)
CREATE POLICY "Users can update own notifications" 
  ON public.notifications 
  FOR UPDATE 
  USING (auth.uid() = recipient_id);

-- 3. Authenticated users can insert notifications for recipients (e.g. project invites, review requests)
CREATE POLICY "Authenticated users can create notifications" 
  ON public.notifications 
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- 4. Users can delete their own notifications
CREATE POLICY "Users can delete own notifications" 
  ON public.notifications 
  FOR DELETE 
  USING (auth.uid() = recipient_id);

-- Enable Realtime publication for instant delivery without polling
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

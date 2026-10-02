-- ==============================================================================
-- Migration v15: Fix Workspace Access, Role Constraints & Notification Table
-- ==============================================================================
-- 1. Updates project_members.role check constraint to support:
--    'owner', 'editor', 'visitor', and legacy 'member'.
-- 2. Ensures public.notifications table exists with RLS and realtime publication.
-- ==============================================================================

-- 1. Relax role check constraint on project_members so 'editor' and 'visitor' are accepted natively
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


-- 2. Ensure public.notifications Table Exists
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'action' | 'information' | 'collaboration'
  category VARCHAR(50) NOT NULL, -- 'project_invitation' | 'join_request' | 'permission_request' | 'review_request' | 'deployment' | 'system' | 'collaborator_joined'
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

-- Drop old policies if any exist
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Public or authenticated insert notifications" ON public.notifications;

-- Strict RLS Policies:
-- 1. Users can only select their own notifications
CREATE POLICY "Users can view own notifications" 
  ON public.notifications 
  FOR SELECT 
  USING (auth.uid() = recipient_id);

-- 2. Users can update their own notifications (e.g. mark read, accept/decline action)
CREATE POLICY "Users can update own notifications" 
  ON public.notifications 
  FOR UPDATE 
  USING (auth.uid() = recipient_id);

-- 3. Any authenticated user can create notifications (e.g. project invitations, join requests)
CREATE POLICY "Authenticated users can create notifications" 
  ON public.notifications 
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL);

-- 4. Users can delete their own notifications
CREATE POLICY "Users can delete own notifications" 
  ON public.notifications 
  FOR DELETE 
  USING (auth.uid() = recipient_id);

-- 3. Ensure public.coding_partners Table Exists
CREATE TABLE IF NOT EXISTS public.coding_partners (
  id TEXT PRIMARY KEY DEFAULT ('partner-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6)),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'ignored', 'rejected', 'cancelled', 'declined')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_coding_partners_pair ON public.coding_partners(requester_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_coding_partners_status ON public.coding_partners(status);

ALTER TABLE public.coding_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own coding partners" ON public.coding_partners;
DROP POLICY IF EXISTS "Users can insert coding partners" ON public.coding_partners;
DROP POLICY IF EXISTS "Users can update own coding partners" ON public.coding_partners;
DROP POLICY IF EXISTS "Users can delete own coding partners" ON public.coding_partners;

CREATE POLICY "Users can view own coding partners" ON public.coding_partners
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert coding partners" ON public.coding_partners
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update own coding partners" ON public.coding_partners
  FOR UPDATE USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can delete own coding partners" ON public.coding_partners
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

-- Enable Realtime publication for notifications and coding_partners
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'coding_partners'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.coding_partners;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore if publication does not exist or insufficient privileges
END $$;


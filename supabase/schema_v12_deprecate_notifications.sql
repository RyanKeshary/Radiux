-- ==============================================================================
-- Migration v12: Deprecate Notifications Table (Requirement Phase 1)
-- ==============================================================================
-- The notification feature has been completely removed from the Radiux product.
-- Existing notification records are preserved to prevent data loss.
-- Application-level dependencies, triggers, and realtime subscriptions are detached.
-- ==============================================================================

COMMENT ON TABLE IF EXISTS public.notifications IS 
  'DEPRECATED: Notifications have been decommissioned from Radiux IDE. Table preserved for historical audit only.';

-- Remove any real-time replication publication for notifications to reduce overhead
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;
  END IF;
END $$;

-- ==============================================================================
-- Radiux Database Schema v11 — Performance Optimization Indexes
-- Safe, additive migration: run in Supabase SQL Editor
-- ==============================================================================

-- 1. Profiles Table Indexes
-- Accelerates login, email search, handle matching, and developer discovery
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles(lower(username));
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON public.profiles(full_name);

-- 2. Projects Table Indexes
-- Accelerates recent workspace sorting and dashboard project listing
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_owner_updated ON public.projects(owner_id, updated_at DESC);

-- 3. Files Table Indexes
-- Accelerates single-file lookups by name within a project
CREATE INDEX IF NOT EXISTS idx_files_project_name ON public.files(project_id, name);

-- 4. Activities Table Indexes
-- Eliminates N+1 and accelerates user contribution heatmap aggregations
CREATE INDEX IF NOT EXISTS idx_activities_user_created ON public.activities(user_id, created_at DESC);

-- 5. Notifications Table Indexes
-- Accelerates notification deletions and partner request resolution
CREATE INDEX IF NOT EXISTS idx_notifications_partner_request ON public.notifications(partner_request_id);

-- 6. Coding Partners Table Indexes
-- Accelerates bidirectional partnership queries
CREATE INDEX IF NOT EXISTS idx_coding_partners_pair ON public.coding_partners(requester_id, receiver_id);

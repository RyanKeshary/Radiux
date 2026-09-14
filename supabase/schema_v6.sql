-- ==============================================================================
-- CodeCollab Schema v6 — Production-Ready Migration
-- Run this AFTER schema.sql (safe additive migration)
-- ==============================================================================

-- 1. Add missing media columns to messages table
alter table public.messages 
  add column if not exists media_type text check (media_type in ('image', 'video', 'audio', 'file')),
  add column if not exists media_url text,
  add column if not exists media_name text;

-- 2. Add target_object column to activities (what was affected)
alter table public.activities
  add column if not exists target_object text default '';

-- 3. Drop the restrictive action_type check if it exists and re-add with expanded types
-- (PostgreSQL does not support altering check constraints directly; drop & recreate)
alter table public.activities drop constraint if exists activities_action_type_check;

-- No longer enforcing enum at DB level — validated at app level for flexibility
-- This allows all Level 4, 5, and 6 event types.

-- 4. Add index for fast timeline queries by project + time
create index if not exists idx_activities_project_time 
  on public.activities(project_id, created_at desc);

create index if not exists idx_messages_project_time 
  on public.messages(project_id, created_at asc);

-- 5. Supabase Storage: chat-media bucket
-- NOTE: Run these via the Supabase Storage dashboard or use the JS client.
-- The bucket must be created manually or via Supabase CLI:
-- supabase storage create-bucket chat-media --public

-- 6. Storage bucket policy (run in SQL editor after bucket is created)
-- Allow authenticated project members to upload to chat-media
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media', 
  true,
  52428800, -- 50MB limit
  array['image/jpeg','image/png','image/gif','image/webp','image/svg+xml','image/avif',
        'video/mp4','video/webm','video/ogg','audio/mpeg','audio/wav','audio/ogg',
        'application/pdf','text/plain','application/zip']
)
on conflict (id) do update set 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = array['image/jpeg','image/png','image/gif','image/webp','image/svg+xml','image/avif',
        'video/mp4','video/webm','video/ogg','audio/mpeg','audio/wav','audio/ogg',
        'application/pdf','text/plain','application/zip'];

-- Storage RLS: allow authenticated users to upload
create policy "Authenticated users can upload chat media" 
  on storage.objects for insert 
  to authenticated
  with check (bucket_id = 'chat-media');

create policy "Public read access for chat media"
  on storage.objects for select
  using (bucket_id = 'chat-media');

create policy "Users can delete their own chat media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'chat-media' and auth.uid()::text = (storage.foldername(name))[1]);

-- 7. Allow service role to insert activities (for server-side logging from WS server)
-- The service role bypasses RLS by default in Supabase, so this is already allowed.
-- Ensure the WS server uses SUPABASE_SERVICE_ROLE_KEY, not the anon key.

-- 8. Profile: add oauth-friendly columns (avatar from OAuth providers)
alter table public.profiles
  add column if not exists provider text default 'email';

-- Update the handle_new_user trigger to also capture provider info
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, provider)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', ''),
    coalesce(new.raw_app_meta_data->>'provider', 'email')
  )
  on conflict (id) do update set
    full_name = coalesce(
      excluded.full_name,
      public.profiles.full_name
    ),
    avatar_url = coalesce(
      excluded.avatar_url,
      public.profiles.avatar_url
    ),
    provider = excluded.provider;
  return new;
end;
$$ language plpgsql security definer;

-- ==============================================================================
-- Summary of Level 6 Activity Event Types (enforced at app level, not DB level)
-- ==============================================================================
-- Project events:    project_created, project_renamed
-- Workspace events:  member_joined, member_invited, member_removed
-- File events:       file_created, file_renamed, file_deleted, file_moved,
--                    folder_created, folder_deleted, media_uploaded
-- Git events:        git_init, git_commit, git_push, git_pull,
--                    git_branch_created, git_branch_deleted, git_branch_switched,
--                    git_remote_configured, git_staged, git_unstaged
-- Voice events:      voice_joined, voice_left, voice_muted, voice_unmuted
-- Runtime events:    server_started, server_stopped
-- ==============================================================================

-- ==============================================================================
-- Radiux Schema v10 — Google + GitHub OAuth, Profiles & Identity Synchronization
-- Run this in your Supabase SQL Editor (safe, additive, non-destructive migration)
-- ==============================================================================

-- 1. Ensure public.profiles table exists with all required columns
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  display_name text,
  avatar_url text,
  username text unique,
  bio text default '',
  role text default 'Developer',
  location text default '',
  education text default '',
  website text default '',
  github_username text default '',
  linkedin_url text default '',
  skills text[] default '{}',
  languages text[] default '{}',
  technologies text[] default '{}',
  other_links jsonb default '[]',
  collaboration_interests text[] default '{}',
  readme_markdown text default '',
  pinned_project_ids text[] default '{}',
  privacy jsonb default '{"show_location": true, "show_education": true, "show_links": true, "show_skills": true, "show_activity": true, "show_readme": true, "show_partners": true, "show_email": false}',
  preferences jsonb default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Add columns to existing profiles table if missing
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='display_name' and table_schema='public') then
    alter table public.profiles add column display_name text;
    update public.profiles set display_name = full_name where display_name is null;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='github_username' and table_schema='public') then
    alter table public.profiles add column github_username text default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='created_at' and table_schema='public') then
    alter table public.profiles add column created_at timestamp with time zone default timezone('utc'::text, now()) not null;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='updated_at' and table_schema='public') then
    alter table public.profiles add column updated_at timestamp with time zone default timezone('utc'::text, now()) not null;
  end if;
end $$;

-- 3. Rapid lookup indexes
create index if not exists idx_profiles_username on public.profiles(username);
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_github on public.profiles(github_username);

-- 4. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- 5. Strict RLS Policies
-- Read: Public directory viewing for collaboration, peer discovery, and partner invites
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone" 
  on public.profiles for select using (true);

-- Insert: Users can only insert their own profile row (auth.uid() = id)
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" 
  on public.profiles for insert with check (auth.uid() = id);

-- Update: Users can only update their own profile row (auth.uid() = id)
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" 
  on public.profiles for update using (auth.uid() = id);

-- Delete: Users can only delete their own profile row (auth.uid() = id)
drop policy if exists "Users can delete their own profile" on public.profiles;
create policy "Users can delete their own profile" 
  on public.profiles for delete using (auth.uid() = id);

-- 6. Trigger to automatically create & synchronize profiles from Google / GitHub OAuth
create or replace function public.handle_new_user()
returns trigger as $$
declare
  raw_name text;
  raw_avatar text;
  raw_username text;
  raw_github text;
begin
  -- Extract display name (Google provides name/full_name, GitHub provides name/user_name)
  raw_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'user_name',
    split_part(new.email, '@', 1),
    'Radiux User'
  );

  -- Extract avatar URL (Google provides picture/avatar_url, GitHub provides avatar_url)
  raw_avatar := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    ''
  );

  -- Extract GitHub username
  raw_github := coalesce(
    new.raw_user_meta_data->>'user_name',
    new.raw_user_meta_data->>'preferred_username',
    ''
  );

  -- Extract username
  raw_username := coalesce(
    new.raw_user_meta_data->>'username',
    raw_github,
    split_part(new.email, '@', 1),
    'user_' || substr(new.id::text, 1, 8)
  );

  -- Insert profile, or on conflict preserve existing customized fields
  insert into public.profiles (
    id,
    email,
    full_name,
    display_name,
    avatar_url,
    username,
    github_username,
    created_at,
    updated_at
  )
  values (
    new.id,
    coalesce(new.email, ''),
    raw_name,
    raw_name,
    raw_avatar,
    raw_username,
    raw_github,
    now(),
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    -- Only update names if currently null or empty or default
    full_name = case 
      when public.profiles.full_name is null or public.profiles.full_name = '' or public.profiles.full_name = 'Radiux User' or public.profiles.full_name = 'User'
      then excluded.full_name 
      else public.profiles.full_name 
    end,
    display_name = case 
      when public.profiles.display_name is null or public.profiles.display_name = '' or public.profiles.display_name = 'Radiux User'
      then excluded.display_name 
      else public.profiles.display_name 
    end,
    -- Only update avatar if currently empty
    avatar_url = case 
      when public.profiles.avatar_url is null or public.profiles.avatar_url = '' 
      then excluded.avatar_url 
      else public.profiles.avatar_url 
    end,
    -- Only update github_username if currently empty
    github_username = case 
      when public.profiles.github_username is null or public.profiles.github_username = '' 
      then excluded.github_username 
      else public.profiles.github_username 
    end,
    updated_at = now();

  return new;
end;
$$ language plpgsql security definer;

-- 7. Attach trigger to auth.users table
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

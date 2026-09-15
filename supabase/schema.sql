-- ==============================================================================
-- CodeCollab Database Schema (Supabase PostgreSQL)
-- ==============================================================================

-- 1. Profiles table linked to Supabase Auth
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  username text unique,
  bio text default '',
  role text default '',
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
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Migration: add missing columns to existing profiles table (safe ALTER TABLE)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='username' and table_schema='public') then
    alter table public.profiles add column username text unique;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='bio' and table_schema='public') then
    alter table public.profiles add column bio text default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='role' and table_schema='public') then
    alter table public.profiles add column role text default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='location' and table_schema='public') then
    alter table public.profiles add column location text default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='education' and table_schema='public') then
    alter table public.profiles add column education text default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='website' and table_schema='public') then
    alter table public.profiles add column website text default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='github_username' and table_schema='public') then
    alter table public.profiles add column github_username text default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='linkedin_url' and table_schema='public') then
    alter table public.profiles add column linkedin_url text default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='skills' and table_schema='public') then
    alter table public.profiles add column skills text[] default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='languages' and table_schema='public') then
    alter table public.profiles add column languages text[] default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='technologies' and table_schema='public') then
    alter table public.profiles add column technologies text[] default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='other_links' and table_schema='public') then
    alter table public.profiles add column other_links jsonb default '[]';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='collaboration_interests' and table_schema='public') then
    alter table public.profiles add column collaboration_interests text[] default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='readme_markdown' and table_schema='public') then
    alter table public.profiles add column readme_markdown text default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='pinned_project_ids' and table_schema='public') then
    alter table public.profiles add column pinned_project_ids text[] default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='privacy' and table_schema='public') then
    alter table public.profiles add column privacy jsonb default '{"show_location": true, "show_education": true, "show_links": true, "show_skills": true, "show_activity": true, "show_readme": true, "show_partners": true, "show_email": false}';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='preferences' and table_schema='public') then
    alter table public.profiles add column preferences jsonb default '{}';
  end if;
end $$;

-- Trigger to create profile when auth.users is created
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Projects table
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Project Members (owner and invited collaborators)
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(project_id, user_id)
);

-- 4. Files & Folders table
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_id uuid references public.files(id) on delete cascade,
  name text not null,
  is_folder boolean not null default false,
  content text default '',
  language text default 'plaintext',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indices for rapid querying
create index if not exists idx_projects_owner on public.projects(owner_id);
create index if not exists idx_project_members_project on public.project_members(project_id);
create index if not exists idx_project_members_user on public.project_members(user_id);
create index if not exists idx_files_project on public.files(project_id);
create index if not exists idx_files_parent on public.files(parent_id);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.files enable row level security;

-- Profiles Policies
create policy "Public profiles are viewable by everyone" 
  on public.profiles for select using (true);

create policy "Users can update their own profile" 
  on public.profiles for update using (auth.uid() = id);

-- Projects Policies
create policy "Users can view projects they own or are members of" 
  on public.projects for select using (
    auth.uid() = owner_id or 
    exists (
      select 1 from public.project_members 
      where project_members.project_id = projects.id 
      and project_members.user_id = auth.uid()
    )
  );

create policy "Authenticated users can create projects" 
  on public.projects for insert with check (auth.uid() = owner_id);

create policy "Project owners can update their projects" 
  on public.projects for update using (auth.uid() = owner_id);

create policy "Project owners can delete their projects" 
  on public.projects for delete using (auth.uid() = owner_id);

-- Project Members Policies
create policy "Project members can view members of same project"
  on public.project_members for select using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = project_members.project_id
      and pm.user_id = auth.uid()
    ) or exists (
      select 1 from public.projects p
      where p.id = project_members.project_id
      and p.owner_id = auth.uid()
    )
  );

create policy "Project owners can insert members"
  on public.project_members for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = project_members.project_id
      and p.owner_id = auth.uid()
    )
  );

create policy "Project owners can delete members"
  on public.project_members for delete using (
    exists (
      select 1 from public.projects p
      where p.id = project_members.project_id
      and p.owner_id = auth.uid()
    )
  );

-- Files Policies
create policy "Project members can view files"
  on public.files for select using (
    exists (
      select 1 from public.projects p
      where p.id = files.project_id and (
        p.owner_id = auth.uid() or exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id and pm.user_id = auth.uid()
        )
      )
    )
  );

create policy "Project members can insert files"
  on public.files for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = files.project_id and (
        p.owner_id = auth.uid() or exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id and pm.user_id = auth.uid()
        )
      )
    )
  );

create policy "Project members can update files"
  on public.files for update using (
    exists (
      select 1 from public.projects p
      where p.id = files.project_id and (
        p.owner_id = auth.uid() or exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id and pm.user_id = auth.uid()
        )
      )
    )
  );

create policy "Project members can delete files"
  on public.files for delete using (
    exists (
      select 1 from public.projects p
      where p.id = files.project_id and (
        p.owner_id = auth.uid() or exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id and pm.user_id = auth.uid()
        )
      )
    )
  );

-- ==============================================================================
-- Level 4: Communication & Collaboration (Messages and Activities)
-- ==============================================================================

-- 5. Project Chat Messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text not null,
  user_avatar text default '',
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_messages_project on public.messages(project_id, created_at);

-- 6. Project Activities table
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text not null,
  action_type text not null,
  details text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_activities_project on public.activities(project_id, created_at desc);

-- Enable RLS for messages and activities
alter table public.messages enable row level security;
alter table public.activities enable row level security;

-- Messages Policies
create policy "Project members can view messages"
  on public.messages for select using (
    exists (
      select 1 from public.projects p
      where p.id = messages.project_id and (
        p.owner_id = auth.uid() or exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id and pm.user_id = auth.uid()
        )
      )
    )
  );

create policy "Project members can insert messages"
  on public.messages for insert with check (
    auth.uid() = user_id and
    exists (
      select 1 from public.projects p
      where p.id = messages.project_id and (
        p.owner_id = auth.uid() or exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id and pm.user_id = auth.uid()
        )
      )
    )
  );

-- Activities Policies
create policy "Project members can view activities"
  on public.activities for select using (
    exists (
      select 1 from public.projects p
      where p.id = activities.project_id and (
        p.owner_id = auth.uid() or exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id and pm.user_id = auth.uid()
        )
      )
    )
  );

create policy "Project members can insert activities"
  on public.activities for insert with check (
    auth.uid() = user_id and
    exists (
      select 1 from public.projects p
      where p.id = activities.project_id and (
        p.owner_id = auth.uid() or exists (
          select 1 from public.project_members pm
          where pm.project_id = p.id and pm.user_id = auth.uid()
        )
      )
    )
  );


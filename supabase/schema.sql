-- ==============================================================================
-- CodeCollab Database Schema (Supabase PostgreSQL)
-- ==============================================================================

-- 1. Profiles table linked to Supabase Auth
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Trigger to create profile when auth.users is created
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
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

-- ==============================================================================
-- CodeCollab Schema v9 — Notifications, Coding Partners & Requests Migration
-- Run this in Supabase SQL Editor (safe additive migration)
-- ==============================================================================

-- 1. Coding Partners & Relationship State Machine
create table if not exists public.coding_partners (
  id text primary key default ('partner-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6)),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'ignored', 'rejected', 'cancelled', 'declined')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for fast lookup by user
create index if not exists idx_coding_partners_requester on public.coding_partners(requester_id);
create index if not exists idx_coding_partners_receiver on public.coding_partners(receiver_id);
create index if not exists idx_coding_partners_status on public.coding_partners(status);

-- 2. Notifications System
create table if not exists public.notifications (
  id text primary key default ('notif-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6)),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('partner_request', 'partner_accepted', 'partner_declined', 'project_invite', 'mention', 'member_joined', 'system')),
  title text not null,
  message text not null,
  sender_id uuid references public.profiles(id) on delete set null,
  sender_name text default '',
  sender_avatar text default '',
  project_id text default null,
  partner_request_id text default null,
  action_status text default 'pending' check (action_status in ('pending', 'accepted', 'ignored', 'rejected', 'completed')),
  data jsonb default '{}',
  read boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for fast unread queries per user
create index if not exists idx_notifications_user on public.notifications(user_id, read, created_at desc);

-- Enable RLS
alter table public.coding_partners enable row level security;
alter table public.notifications enable row level security;

-- Policies for Coding Partners
create policy "Users can view coding partners where they are requester or receiver"
  on public.coding_partners for select using (
    auth.uid() = requester_id or auth.uid() = receiver_id
  );

create policy "Users can insert coding partners as requester"
  on public.coding_partners for insert with check (
    auth.uid() = requester_id
  );

create policy "Users can update their coding partner requests"
  on public.coding_partners for update using (
    auth.uid() = requester_id or auth.uid() = receiver_id
  );

create policy "Users can delete their coding partner requests"
  on public.coding_partners for delete using (
    auth.uid() = requester_id or auth.uid() = receiver_id
  );

-- Policies for Notifications
create policy "Users can view their own notifications"
  on public.notifications for select using (
    auth.uid() = user_id
  );

create policy "Users can insert notifications"
  on public.notifications for insert with check (
    true
  );

create policy "Users can update their own notifications"
  on public.notifications for update using (
    auth.uid() = user_id
  );

create policy "Users can delete their own notifications"
  on public.notifications for delete using (
    auth.uid() = user_id
  );

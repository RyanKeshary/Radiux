'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ActivityEvent, ActivityActionType } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { config } from '@/lib/config';
import { Loader2, Activity as ActivityIcon, RefreshCw, ChevronDown } from 'lucide-react';

interface ActivityFeedProps {
  projectId: string;
}

// ============================================================================
// Compact activity row metadata
// ============================================================================

type Category = 'file' | 'git' | 'member' | 'voice' | 'runtime';

interface ActionMeta {
  verb: string;
  category: Category;
}

const ACTION_META: Record<ActivityActionType, ActionMeta> = {
  // Project
  project_created:         { verb: 'created',   category: 'member' },
  project_renamed:         { verb: 'renamed',   category: 'member' },
  // Member
  member_joined:           { verb: 'joined',    category: 'member' },
  member_left:             { verb: 'left',      category: 'member' },
  member_invited:          { verb: 'invited',   category: 'member' },
  member_removed:          { verb: 'removed',   category: 'member' },
  // Files
  file_created:            { verb: 'created',   category: 'file' },
  file_saved:              { verb: 'saved',     category: 'file' },
  file_renamed:            { verb: 'renamed',   category: 'file' },
  file_deleted:            { verb: 'deleted',   category: 'file' },
  file_moved:              { verb: 'moved',     category: 'file' },
  folder_created:          { verb: 'created',   category: 'file' },
  folder_deleted:          { verb: 'deleted',   category: 'file' },
  media_uploaded:          { verb: 'uploaded',  category: 'file' },
  // Git
  git_init:                { verb: 'init',      category: 'git' },
  git_commit:              { verb: 'committed', category: 'git' },
  git_push:                { verb: 'pushed',    category: 'git' },
  git_pull:                { verb: 'pulled',    category: 'git' },
  git_branch_created:      { verb: 'branch+',  category: 'git' },
  git_branch_deleted:      { verb: 'branch-',  category: 'git' },
  git_branch_switched:     { verb: 'checkout', category: 'git' },
  git_remote_configured:   { verb: 'remote',   category: 'git' },
  git_staged:              { verb: 'staged',   category: 'git' },
  git_unstaged:            { verb: 'unstaged', category: 'git' },
  // Voice
  voice_joined:            { verb: 'joined',   category: 'voice' },
  voice_left:              { verb: 'left',     category: 'voice' },
  voice_muted:             { verb: 'muted',    category: 'voice' },
  voice_unmuted:           { verb: 'unmuted',  category: 'voice' },
  // Runtime
  server_started:          { verb: 'started',  category: 'runtime' },
  server_stopped:          { verb: 'stopped',  category: 'runtime' },
};

// Colors for each verb
const VERB_COLORS: Record<string, string> = {
  // creates / joins
  created:   'text-emerald-400',
  saved:     'text-emerald-400',
  joined:    'text-emerald-400',
  started:   'text-emerald-400',
  init:      'text-emerald-400',
  'branch+': 'text-emerald-400',
  invited:   'text-sky-400',
  uploaded:  'text-sky-400',
  committed: 'text-violet-400',
  pushed:    'text-violet-400',
  pulled:    'text-violet-400',
  checkout:  'text-violet-400',
  remote:    'text-violet-400',
  staged:    'text-blue-400',
  unstaged:  'text-neutral-400',
  // renames / moves
  renamed:   'text-amber-400',
  moved:     'text-amber-400',
  // deletes / leaves
  deleted:   'text-rose-400',
  left:      'text-rose-400',
  stopped:   'text-rose-400',
  removed:   'text-rose-400',
  'branch-': 'text-rose-400',
  // voice
  muted:     'text-neutral-400',
  unmuted:   'text-sky-400',
};

const CATEGORY_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Files', value: 'file' },
  { label: 'Git', value: 'git' },
  { label: 'Members', value: 'member' },
  { label: 'Voice', value: 'voice' },
  { label: 'Runtime', value: 'runtime' },
] as const;

type FilterValue = (typeof CATEGORY_FILTERS)[number]['value'];

// Format time as HH:MM:SS
function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '--:--:--';
  }
}

// Format full date for tooltip
function formatFull(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString();
  } catch {
    return isoString;
  }
}

// Truncate long strings to keep columns tight
function truncate(s: string, max: number): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// Get category for fallback (unknown action types)
function getCategoryForFilter(event: ActivityEvent): Category {
  const meta = ACTION_META[event.action_type];
  if (meta) return meta.category;
  if (event.action_type.startsWith('git_')) return 'git';
  if (event.action_type.startsWith('voice_')) return 'voice';
  if (event.action_type.startsWith('file_') || event.action_type.startsWith('folder_')) return 'file';
  if (event.action_type.startsWith('server_')) return 'runtime';
  return 'member';
}

// ============================================================================
// Main component
// ============================================================================

export function ActivityFeed({ projectId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const PAGE_SIZE = 80;

  const fetchActivities = useCallback(async (reset = false) => {
    try {
      if (reset) setLoading(true);
      const acts = await DataService.getActivities(projectId);
      if (reset) {
        setActivities(acts);
        setPage(0);
        setHasMore(acts.length >= PAGE_SIZE);
      } else {
        setActivities((prev) => {
          const existingIds = new Set(prev.map((a) => a.id));
          const newItems = acts.filter((a) => !existingIds.has(a.id));
          return [...newItems, ...prev];
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchActivities(true);
  }, [fetchActivities]);

  // Real-time activity events via WebSocket comm room
  useEffect(() => {
    const wsUrl = config.buildWsUrl('/comm', { projectId });

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'activity_event' && msg.activity) {
            setActivities((prev) => {
              // Avoid duplicates
              if (prev.some((a) => a.id === msg.activity.id)) return prev;
              return [msg.activity, ...prev];
            });
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        // Reconnect after 3s if closed unexpectedly
        setTimeout(() => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) {
            connect();
          }
        }, 3000);
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [projectId]);

  // Apply category filter
  const filtered = activities.filter((a) => {
    if (filter === 'all') return true;
    return getCategoryForFilter(a) === filter;
  });

  return (
    <div 
      className="flex flex-col h-full w-full select-none"
      style={{
        backgroundColor: 'var(--ide-dock)',
        color: 'var(--ide-text)',
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-2 border-b shrink-0 w-full"
        style={{
          backgroundColor: 'var(--ide-dock-header)',
          borderColor: 'var(--ide-border)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <ActivityIcon className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--ide-text)' }}>Activity Log</span>
          <span className="ml-1 text-[10px] opacity-60 font-mono">{filtered.length}</span>
        </div>
        <button
          onClick={() => fetchActivities(true)}
          title="Refresh"
          className="p-1 rounded opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Category filter pills */}
      <div 
        className="flex items-center gap-1 px-3 py-1.5 border-b shrink-0 overflow-x-auto w-full"
        style={{ borderColor: 'var(--ide-border)' }}
      >
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`shrink-0 px-2.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
              filter === f.value
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 font-semibold'
                : 'opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Log rows */}
      <div className="flex-1 w-full overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full gap-2 opacity-60 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
            <span>Loading activity…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-60 text-xs gap-2">
            <ActivityIcon className="w-8 h-8 opacity-40" />
            <p className="font-mono">No activity yet</p>
            <p className="text-[10px] opacity-70">Events appear here as the workspace is used</p>
          </div>
        ) : (
          <div className="font-mono text-[11px] leading-none w-full">
            {/* Column headers */}
            <div 
              className="flex items-center px-3 py-1.5 border-b text-[10px] uppercase tracking-wider select-none sticky top-0 z-10 w-full"
              style={{
                backgroundColor: 'var(--ide-dock)',
                borderColor: 'var(--ide-border)',
                color: 'var(--ide-text-muted)',
              }}
            >
              <span className="w-20 shrink-0">Time</span>
              <span className="w-28 shrink-0">User</span>
              <span className="w-24 shrink-0">Action</span>
              <span className="flex-1 min-w-0">Target / Details</span>
            </div>

            {filtered.map((event) => {
              const meta = ACTION_META[event.action_type] || { verb: event.action_type, category: 'member' as Category };
              const verbColor = VERB_COLORS[meta.verb] || 'text-neutral-400';
              const target = event.target_object || '';
              const displayTarget = target ? `${target} — ${event.details}` : event.details;

              return (
                <div
                  key={event.id}
                  className="flex items-center px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 border-b transition-colors group w-full"
                  style={{ borderColor: 'var(--ide-border)' }}
                  title={`${formatFull(event.created_at)} — ${event.details}`}
                >
                  {/* Time */}
                  <span className="w-20 shrink-0 opacity-60 font-mono text-[10px]">
                    {formatTime(event.created_at)}
                  </span>

                  {/* User */}
                  <span className="w-28 shrink-0 font-medium truncate pr-2" style={{ color: 'var(--ide-text)' }} title={event.user_name}>
                    {event.user_name}
                  </span>

                  {/* Action verb — color-coded */}
                  <span className={`w-24 shrink-0 ${verbColor} font-medium`}>
                    {meta.verb}
                  </span>

                  {/* Target / Details */}
                  <span className="flex-1 min-w-0 opacity-80 truncate" style={{ color: 'var(--ide-text-muted)' }} title={event.details}>
                    {displayTarget}
                  </span>
                </div>
              );
            })}

            {/* Load more */}
            {hasMore && (
              <button
                onClick={() => fetchActivities(false)}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-t"
                style={{ borderColor: 'var(--ide-border)' }}
              >
                <ChevronDown className="w-3 h-3" />
                Load older events
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useState, useRef } from 'react';
import { ActivityEvent } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { 
  FilePlus, 
  FileEdit, 
  Trash2, 
  PhoneCall, 
  PhoneOff, 
  Server, 
  UserCheck, 
  Activity as ActivityIcon,
  Loader2,
  Clock,
  UploadCloud,
  Users,
  Film
} from 'lucide-react';

interface ActivityFeedProps {
  projectId: string;
}

export function ActivityFeed({ projectId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'members' | 'files' | 'voice'>('all');
  const wsRef = useRef<WebSocket | null>(null);

  const fetchActivities = async () => {
    try {
      const acts = await DataService.getActivities(projectId);
      setActivities(acts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [projectId]);

  // Real-time activity events via WebSocket
  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:1234/comm?projectId=${projectId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'activity_event' && data.activity) {
          const act: ActivityEvent = data.activity;
          setActivities((prev) => [act, ...prev.filter((a) => a.id !== act.id)].slice(0, 200));
        }
      } catch (e) {}
    };

    return () => {
      ws.close();
    };
  }, [projectId]);

  const getActivityIcon = (type: ActivityEvent['action_type']) => {
    switch (type) {
      case 'file_created':
        return <FilePlus className="w-3.5 h-3.5 text-emerald-400" />;
      case 'media_uploaded':
        return <UploadCloud className="w-3.5 h-3.5 text-sky-400" />;
      case 'file_renamed':
        return <FileEdit className="w-3.5 h-3.5 text-amber-400" />;
      case 'file_deleted':
        return <Trash2 className="w-3.5 h-3.5 text-rose-400" />;
      case 'voice_joined':
        return <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />;
      case 'voice_left':
        return <PhoneOff className="w-3.5 h-3.5 text-neutral-400" />;
      case 'server_started':
      case 'server_stopped':
        return <Server className="w-3.5 h-3.5 text-purple-400" />;
      case 'member_joined':
        return <UserCheck className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <ActivityIcon className="w-3.5 h-3.5 text-neutral-400" />;
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const now = Date.now();
      const timestamp = new Date(isoString).getTime();
      const diffSec = Math.floor((now - timestamp) / 1000);

      if (diffSec < 10) return 'just now';
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour}h ago`;
      return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const filteredActivities = activities.filter((act) => {
    if (filter === 'all') return true;
    if (filter === 'members') return act.action_type === 'member_joined';
    if (filter === 'files') return ['file_created', 'file_renamed', 'file_deleted', 'media_uploaded'].includes(act.action_type);
    if (filter === 'voice') return ['voice_joined', 'voice_left', 'server_started', 'server_stopped'].includes(act.action_type);
    return true;
  });

  return (
    <div className="flex flex-col h-full w-full bg-[#181818] p-3 overflow-hidden select-none">
      {/* Header & Filter Controls */}
      <div className="flex items-center justify-between pb-2 border-b border-[#333333] mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ActivityIcon className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-bold text-white">Project Activity Timeline</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#2a2d2e] text-neutral-400 font-mono">
            {activities.length} events recorded
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 text-[11px] bg-[#252526] p-0.5 rounded-lg border border-[#333333]">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-0.5 rounded-md transition-colors ${
              filter === 'all' ? 'bg-[#094771] text-white font-medium' : 'text-neutral-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('members')}
            className={`px-2 py-0.5 rounded-md transition-colors ${
              filter === 'members' ? 'bg-[#094771] text-white font-medium' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Users Joined
          </button>
          <button
            onClick={() => setFilter('files')}
            className={`px-2 py-0.5 rounded-md transition-colors ${
              filter === 'files' ? 'bg-[#094771] text-white font-medium' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Files & Media
          </button>
          <button
            onClick={() => setFilter('voice')}
            className={`px-2 py-0.5 rounded-md transition-colors ${
              filter === 'voice' ? 'bg-[#094771] text-white font-medium' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Voice & Runtime
          </button>
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
            <span className="text-xs">Loading activity timeline from project origin...</span>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-2 py-8">
            <Clock className="w-8 h-8 text-neutral-600" />
            <p className="text-xs font-medium text-neutral-400">No matching activities found</p>
            <p className="text-[11px] text-neutral-600">Events from users entering the workspace and creating media will display here.</p>
          </div>
        ) : (
          filteredActivities.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-2 rounded-lg bg-[#252526]/70 border border-[#333333] hover:border-[#444444] transition-colors"
            >
              <div className="p-1.5 rounded-md bg-[#1e1e1e] flex-shrink-0 mt-0.5 border border-[#3c3c3c]">
                {getActivityIcon(item.action_type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-neutral-200 truncate">
                    {item.user_name}
                  </span>
                  <span className="text-[10px] text-neutral-500 flex-shrink-0">
                    {formatRelativeTime(item.created_at)}
                  </span>
                </div>
                <p className="text-xs text-neutral-300 mt-0.5 break-words">
                  {item.details}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Check,
  X,
  CheckCheck,
  UserPlus,
  GitPullRequest,
  Shield,
  Rocket,
  Info,
  Users,
  Loader2,
} from 'lucide-react';
import { AppNotification, NotificationCategory } from '@/lib/notifications/types';
import { NotificationService } from '@/lib/notifications/notification-service';

interface NotificationCenterProps {
  userId: string;
  onNavigateToProject?: (projectId: string) => void;
}

export function NotificationCenter({ userId, onNavigateToProject }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  // Initial load
  useEffect(() => {
    if (!userId || userId === 'guest') return;
    let mounted = true;

    async function load() {
      setLoading(true);
      const data = await NotificationService.fetchNotifications(userId);
      if (mounted) {
        setNotifications(data);
        setLoading(false);
      }
    }

    load();

    // Subscribe to realtime changes
    const unsubscribe = NotificationService.subscribe(userId, (newOrUpdated) => {
      setNotifications((prev) => {
        const index = prev.findIndex((n) => n.id === newOrUpdated.id);
        if (index !== -1) {
          const clone = [...prev];
          clone[index] = newOrUpdated;
          return clone;
        }
        return [newOrUpdated, ...prev];
      });
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [userId]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id: string) => {
    await NotificationService.markAsRead(id, userId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
  };

  const handleMarkAllRead = async () => {
    await NotificationService.markAllAsRead(userId);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
    );
  };

  const handleAction = async (notification: AppNotification, action: 'accept' | 'decline') => {
    setActionInProgress(notification.id);
    const success = await NotificationService.respondToAction(notification, action);
    if (success) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id
            ? {
                ...n,
                action_state: action === 'accept' ? 'accepted' : 'declined',
                read_at: new Date().toISOString(),
              }
            : n
        )
      );
      if (action === 'accept' && notification.project_id && onNavigateToProject) {
        onNavigateToProject(notification.project_id);
      }
    }
    setActionInProgress(null);
  };

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'project_invitation':
        return <UserPlus className="w-4 h-4 text-sky-400" />;
      case 'review_request':
        return <GitPullRequest className="w-4 h-4 text-purple-400" />;
      case 'permission_request':
        return <Shield className="w-4 h-4 text-amber-400" />;
      case 'deployment':
        return <Rocket className="w-4 h-4 text-emerald-400" />;
      case 'collaborator_joined':
        return <Users className="w-4 h-4 text-cyan-400" />;
      default:
        return <Info className="w-4 h-4 text-neutral-400" />;
    }
  };

  const formatRelativeTime = (iso: string) => {
    try {
      const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (diffSec < 60) return 'just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1.5 rounded text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.07] transition-colors focus:outline-none"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-1 bg-sky-500 text-[9px] font-bold text-white rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-lg shadow-2xl border z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{
            backgroundColor: 'var(--ide-bg, #1e1e1e)',
            borderColor: 'var(--ide-border, #333)',
            color: 'var(--ide-text, #ccc)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.08] bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-200">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-sky-300 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-white/[0.04]">
            {loading && notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                <span>Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center text-xs text-neutral-500">
                No notifications right now.
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = !n.read_at;
                const isBusy = actionInProgress === n.id;

                return (
                  <div
                    key={n.id}
                    onClick={() => isUnread && handleMarkAsRead(n.id)}
                    className={`p-3 transition-colors cursor-pointer text-xs ${
                      isUnread ? 'bg-white/[0.03] hover:bg-white/[0.06]' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex-shrink-0 p-1 rounded bg-white/[0.05]">
                        {getCategoryIcon(n.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`font-medium truncate ${
                              isUnread ? 'text-white' : 'text-neutral-300'
                            }`}
                          >
                            {n.title}
                          </span>
                          <span className="text-[10px] text-neutral-500 whitespace-nowrap">
                            {formatRelativeTime(n.created_at)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-neutral-400 text-[11px] leading-relaxed line-clamp-2">
                          {n.body}
                        </p>

                        {/* Actionable Controls (Accept / Decline) */}
                        {n.type === 'action' && n.action_state && (
                          <div className="mt-2 flex items-center gap-2">
                            {n.action_state === 'pending' ? (
                              <>
                                <button
                                  disabled={isBusy}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAction(n, 'accept');
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded transition-colors"
                                >
                                  {isBusy ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                  <span>Accept</span>
                                </button>
                                <button
                                  disabled={isBusy}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAction(n, 'decline');
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-neutral-300 hover:text-white bg-white/[0.08] hover:bg-white/[0.14] disabled:opacity-50 rounded transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Decline</span>
                                </button>
                              </>
                            ) : (
                              <span
                                className={`text-[10px] font-medium px-2 py-0.5 rounded capitalize ${
                                  n.action_state === 'accepted'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                                }`}
                              >
                                {n.action_state}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

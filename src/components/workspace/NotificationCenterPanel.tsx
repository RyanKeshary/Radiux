'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { 
  Bell, 
  Check, 
  X, 
  UserCheck, 
  UserPlus, 
  UserX,
  FolderPlus, 
  MessageSquare, 
  CheckCheck,
  ExternalLink,
  Filter,
  Trash2,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';
import { soundManager } from '@/lib/sound';

export interface AppNotification {
  id: string;
  type: 'partner_request' | 'partner_accepted' | 'partner_declined' | 'project_invite' | 'mention' | 'member_joined' | 'system';
  title: string;
  message: string;
  senderName?: string;
  senderAvatar?: string;
  senderId?: string;
  projectId?: string;
  partnerRequestId?: string;
  actionStatus?: 'pending' | 'accepted' | 'ignored' | 'rejected' | 'completed';
  read: boolean;
  createdAt: string;
}

interface NotificationCenterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onMarkRead?: (id: string) => void;
  onAcceptPartnerRequest?: (requestId: string, notificationId?: string) => void;
  onDeclinePartnerRequest?: (requestId: string, notificationId?: string) => void;
  onIgnorePartnerRequest?: (requestId: string, notificationId?: string) => void;
  onOpenProject?: (projectId: string) => void;
  onDismissNotification?: (id: string) => void;
  onClearAll?: () => void;
  onUserClick?: (userId: string, targetEl?: HTMLElement) => void;
}

type NotificationCategory = 'all' | 'requests' | 'invites' | 'mentions' | 'system';

export function NotificationCenterPanel({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onMarkRead,
  onAcceptPartnerRequest,
  onDeclinePartnerRequest,
  onIgnorePartnerRequest,
  onOpenProject,
  onDismissNotification,
  onClearAll,
  onUserClick,
}: NotificationCenterPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [category, setCategory] = useState<NotificationCategory>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Synchronize sound preferences
  useEffect(() => {
    setSoundEnabled(soundManager.isEnabled());
  }, [isOpen]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.setEnabled(next);
  };

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, onClose]);

  // Outside click close
  useClickOutside(panelRef, onClose, isOpen);

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  const filtered = notifications.filter((n) => {
    if (category === 'requests') {
      return n.type === 'partner_request' || n.type === 'partner_accepted' || n.type === 'partner_declined';
    }
    if (category === 'invites') {
      return n.type === 'project_invite';
    }
    if (category === 'mentions') {
      return n.type === 'mention';
    }
    if (category === 'system') {
      return n.type === 'system' || n.type === 'member_joined';
    }
    return true;
  });

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex justify-end transition-opacity duration-200 animate-in fade-in select-none"
      onClick={onClose}
    >
      <div 
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm h-full shadow-2xl border-l flex flex-col overflow-hidden text-xs transform transition-transform duration-200 animate-in slide-in-from-right"
        style={{
          backgroundColor: 'var(--ide-bg)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
      >
        {/* Top Header */}
        <div 
          className="h-12 px-4 border-b flex items-center justify-between flex-shrink-0"
          style={{ 
            backgroundColor: 'var(--ide-dock-header)', 
            borderColor: 'var(--ide-border)' 
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Bell className="w-4 h-4 text-sky-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-sky-500 ring-2 ring-[var(--ide-dock-header)] animate-pulse" />
              )}
            </div>
            <span className="font-semibold text-sm tracking-wide" style={{ color: 'var(--ide-text)' }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <span 
                className="px-1.5 py-0.5 text-[10px] font-bold rounded-full text-white"
                style={{ backgroundColor: 'var(--ide-accent)' }}
              >
                {unreadCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Sound toggle button */}
            <button
              onClick={toggleSound}
              className={`p-1.5 rounded hover:bg-white/10 transition-colors ${soundEnabled ? 'text-sky-400' : 'text-neutral-500'}`}
              title={soundEnabled ? 'Notification chime: Enabled' : 'Notification chime: Muted'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="p-1.5 rounded hover:bg-white/10 transition-colors text-neutral-400 hover:text-sky-400"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
              </button>
            )}

            {onClearAll && notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="p-1.5 rounded hover:bg-white/10 transition-colors text-neutral-400 hover:text-rose-400"
                title="Clear all notifications"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              style={{ color: 'var(--ide-text-muted)' }}
              title="Close panel (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Pills Filter */}
        <div 
          className="px-3 py-2 border-b flex items-center gap-1 overflow-x-auto flex-shrink-0"
          style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-card-bg)' }}
        >
          {[
            { id: 'all', label: 'All' },
            { id: 'requests', label: 'Requests' },
            { id: 'invites', label: 'Invites' },
            { id: 'mentions', label: 'Mentions' },
            { id: 'system', label: 'System' },
          ].map((tab) => {
            const isActive = category === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCategory(tab.id as NotificationCategory)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex-shrink-0 ${
                  isActive
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {filtered.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-2 opacity-50">
              <Bell className="w-8 h-8 stroke-[1.5]" />
              <p className="font-medium text-xs">No notifications in {category}</p>
              <p className="text-[11px] opacity-70">You are all caught up!</p>
            </div>
          ) : (
            filtered.map((n) => {
              const isHovered = hoveredId === n.id;
              const isUnread = !n.read;

              return (
                <div
                  key={n.id}
                  onMouseEnter={() => setHoveredId(n.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => {
                    if (isUnread && onMarkRead) onMarkRead(n.id);
                  }}
                  className={`relative p-3 rounded-lg border transition-all duration-150 group backdrop-blur-md ${
                    isUnread
                      ? 'border-sky-500/30 bg-sky-500/[0.04]'
                      : 'border-white/[0.06] hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.05]'
                  } ${isHovered ? 'shadow-lg ring-1 ring-white/10 -translate-y-0.5' : ''}`}
                  style={{
                    backgroundColor: isHovered 
                      ? 'var(--ide-card-bg)' 
                      : undefined
                  }}
                >
                  {/* Unread indicator dot */}
                  {isUnread && (
                    <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-sky-400 shadow-sm shadow-sky-400" />
                  )}

                  <div className="flex items-start gap-3">
                    {/* Icon / Sender Avatar */}
                    <div className="mt-0.5 flex-shrink-0">
                      {n.senderAvatar ? (
                        <img 
                          src={n.senderAvatar} 
                          alt={n.senderName || 'Avatar'}
                          onClick={(e) => {
                            if (n.senderId && onUserClick) {
                              e.stopPropagation();
                              onUserClick(n.senderId, e.currentTarget);
                            }
                          }}
                          className="w-7 h-7 rounded-full object-cover border border-white/10 hover:border-sky-400 cursor-pointer transition-all"
                        />
                      ) : (
                        <div 
                          className="w-7 h-7 rounded-full flex items-center justify-center border"
                          style={{ 
                            backgroundColor: 'var(--ide-dock-header)',
                            borderColor: 'var(--ide-border)'
                          }}
                        >
                          {n.type === 'partner_request' && <UserPlus className="w-3.5 h-3.5 text-sky-400" />}
                          {n.type === 'partner_accepted' && <UserCheck className="w-3.5 h-3.5 text-emerald-400" />}
                          {n.type === 'partner_declined' && <UserX className="w-3.5 h-3.5 text-rose-400" />}
                          {n.type === 'project_invite' && <FolderPlus className="w-3.5 h-3.5 text-indigo-400" />}
                          {n.type === 'mention' && <MessageSquare className="w-3.5 h-3.5 text-amber-400" />}
                          {n.type === 'system' && <Info className="w-3.5 h-3.5 text-cyan-400" />}
                          {n.type === 'member_joined' && <Sparkles className="w-3.5 h-3.5 text-purple-400" />}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-baseline justify-between gap-1">
                        <span 
                          className="font-semibold text-[11.5px] truncate"
                          style={{ color: 'var(--ide-text)' }}
                        >
                          {n.title}
                        </span>
                      </div>

                      <p 
                        className="text-[11px] mt-0.5 leading-relaxed break-words"
                        style={{ color: 'var(--ide-text-muted)' }}
                      >
                        {n.message}
                      </p>

                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-neutral-500">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{n.createdAt}</span>
                      </div>

                      {/* Interactive Actions for Friend / Collaborator Requests */}
                      {n.type === 'partner_request' && n.partnerRequestId && (
                        <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center gap-2">
                          {n.actionStatus === 'accepted' ? (
                            <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Partner Request Accepted
                            </span>
                          ) : n.actionStatus === 'ignored' ? (
                            <span className="text-[11px] font-medium text-neutral-500 italic">
                              Request Ignored
                            </span>
                          ) : n.actionStatus === 'rejected' ? (
                            <span className="text-[11px] font-medium text-rose-400 italic">
                              Request Declined
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onAcceptPartnerRequest) onAcceptPartnerRequest(n.partnerRequestId!, n.id);
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-medium transition-colors flex items-center gap-1 shadow-sm"
                              >
                                <Check className="w-3 h-3" />
                                <span>Accept</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onIgnorePartnerRequest) {
                                    onIgnorePartnerRequest(n.partnerRequestId!, n.id);
                                  } else if (onDeclinePartnerRequest) {
                                    onDeclinePartnerRequest(n.partnerRequestId!, n.id);
                                  }
                                }}
                                className="px-2.5 py-1 rounded text-[11px] border transition-colors hover:bg-white/10 text-neutral-300"
                                style={{
                                  backgroundColor: 'var(--ide-input-bg)',
                                  borderColor: 'var(--ide-border)',
                                }}
                              >
                                Ignore
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {/* Interactive Actions for Project Invites */}
                      {n.type === 'project_invite' && n.projectId && (
                        <div className="mt-2.5 pt-2 border-t border-white/5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onOpenProject) onOpenProject(n.projectId!);
                            }}
                            className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[11px] font-medium transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <span>Open Project Workspace</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Dismiss Button on Hover */}
                    {onDismissNotification && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDismissNotification(n.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-opacity text-neutral-400 hover:text-rose-400"
                        title="Dismiss notification"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

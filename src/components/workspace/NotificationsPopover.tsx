'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { Sound } from '@/lib/audio';
import { 
  Bell, 
  Check, 
  X, 
  UserCheck, 
  UserPlus, 
  FolderPlus, 
  MessageSquare, 
  CheckCheck,
  ExternalLink,
  Clock,
  ChevronRight,
  Sparkles,
  PauseCircle,
  XCircle,
  CheckCircle2,
  Filter
} from 'lucide-react';

export interface AppNotification {
  id: string;
  type: 'partner_request' | 'partner_accepted' | 'project_invite' | 'mention' | 'system';
  title: string;
  message: string;
  senderName?: string;
  senderAvatar?: string;
  projectId?: string;
  partnerRequestId?: string;
  read: boolean;
  createdAt: string;
  held?: boolean;
}

// ---------------------------------------------------------------------------
// 1. Stacked Glassmorphic Notification Toast (Hover Deck)
// ---------------------------------------------------------------------------
interface StackedNotificationToastProps {
  notifications: AppNotification[];
  onAcceptPartnerRequest?: (requestId: string) => void;
  onDeclinePartnerRequest?: (requestId: string) => void;
  onHoldPartnerRequest?: (notificationId: string) => void;
  onOpenProject?: (projectId: string) => void;
  onDismissNotification?: (id: string) => void;
  onOpenDrawer?: () => void;
}

export function StackedNotificationToast({
  notifications,
  onAcceptPartnerRequest,
  onDeclinePartnerRequest,
  onHoldPartnerRequest,
  onOpenProject,
  onDismissNotification,
  onOpenDrawer,
}: StackedNotificationToastProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [dismissedToastIds, setDismissedToastIds] = useState<Set<string>>(new Set());

  // Filter unread & non-dismissed toast notifications
  const activeNotifs = notifications
    .filter(n => !dismissedToastIds.has(n.id) && !n.held)
    .slice(0, 3); // Current + recent 2 below

  if (activeNotifs.length === 0) return null;

  const topNotif = activeNotifs[0];
  const stackedBelow = activeNotifs.slice(1, 3);

  const handleDismiss = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDismissedToastIds(prev => new Set(prev).add(id));
    if (onDismissNotification) onDismissNotification(id);
    Sound.playHapticPop();
  };

  return (
    <aside 
      aria-label="Recent notifications"
      className="fixed top-14 right-6 z-50 flex flex-col items-end pointer-events-auto select-none"
      onMouseEnter={() => {
        setIsHovered(true);
        Sound.playHapticPop();
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative w-84 sm:w-96 transition-all duration-300 ease-out">
        {/* Main / Top Glassmorphic Tile */}
        <div 
          className={`relative z-30 rounded-2xl p-4 shadow-2xl border transition-all duration-300 backdrop-blur-xl ${
            isHovered ? 'scale-[1.02] shadow-sky-500/20' : 'hover:scale-[1.01]'
          }`}
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.88), rgba(15, 23, 42, 0.94))',
            borderColor: 'rgba(56, 189, 248, 0.35)',
            boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.6), 0 0 20px 2px rgba(56, 189, 248, 0.15)',
          }}
        >
          {/* Header indicator */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {topNotif.type === 'partner_request' ? 'Friend Request' : topNotif.title}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">{topNotif.createdAt}</span>
              <button
                onClick={(e) => handleDismiss(topNotif.id, e)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-sky-400/20 overflow-hidden flex-shrink-0">
              {topNotif.senderAvatar ? (
                <img src={topNotif.senderAvatar} alt="" className="w-full h-full object-cover" />
              ) : topNotif.senderName ? (
                topNotif.senderName.charAt(0).toUpperCase()
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-100 truncate">
                {topNotif.senderName || topNotif.title}
              </p>
              <p className="text-[11.5px] text-slate-300 mt-0.5 leading-snug">
                {topNotif.message}
              </p>
            </div>
          </div>

          {/* Action Buttons for Friend Requests */}
          {(topNotif.type === 'partner_request' || topNotif.partnerRequestId) && (
            <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center gap-2">
              {/* 1. Accept */}
              <button
                onClick={() => {
                  if (topNotif.partnerRequestId && onAcceptPartnerRequest) {
                    onAcceptPartnerRequest(topNotif.partnerRequestId);
                  }
                  handleDismiss(topNotif.id);
                }}
                className="flex-1 py-1.5 px-3 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-semibold rounded-lg text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Accept</span>
              </button>

              {/* 2. Reject */}
              <button
                onClick={() => {
                  if (topNotif.partnerRequestId && onDeclinePartnerRequest) {
                    onDeclinePartnerRequest(topNotif.partnerRequestId);
                  }
                  handleDismiss(topNotif.id);
                }}
                className="py-1.5 px-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-medium active:scale-95 transition-all flex items-center justify-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>

              {/* 3. Hold / Ignore */}
              <button
                onClick={() => {
                  if (onHoldPartnerRequest) onHoldPartnerRequest(topNotif.id);
                  handleDismiss(topNotif.id);
                }}
                className="py-1.5 px-2.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium active:scale-95 transition-all flex items-center justify-center gap-1"
                title="Hold / Review later"
              >
                <PauseCircle className="w-3.5 h-3.5" />
                <span>Hold</span>
              </button>
            </div>
          )}

          {/* Action for Project Invites */}
          {topNotif.type === 'project_invite' && topNotif.projectId && (
            <div className="mt-3 pt-2.5 border-t border-white/10 flex justify-end">
              <button
                onClick={() => {
                  if (onOpenProject) onOpenProject(topNotif.projectId!);
                  handleDismiss(topNotif.id);
                }}
                className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-md"
              >
                <span>Open Project</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Hint to hover or open sidebar */}
          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
            <span>{stackedBelow.length > 0 ? (isHovered ? 'Showing recent notifications' : `+${stackedBelow.length} more (hover to inspect)`) : 'Click to view all'}</span>
            <button 
              onClick={onOpenDrawer}
              className="text-sky-400 hover:text-sky-300 font-medium flex items-center gap-0.5"
            >
              View Sidebar <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Stacked Glassmorphic Cards Below (Animated on Hover) */}
        {stackedBelow.map((notif, idx) => {
          const depth = idx + 1; // 1 or 2
          return (
            <div
              key={notif.id}
              className={`absolute left-0 right-0 rounded-2xl p-3.5 border backdrop-blur-xl transition-all duration-300 ease-out ${
                isHovered
                  ? 'opacity-100 pointer-events-auto'
                  : depth === 1
                  ? 'opacity-60 pointer-events-none'
                  : 'opacity-30 pointer-events-none'
              }`}
              style={{
                top: isHovered ? `${depth * 115}px` : `${depth * 8}px`,
                transform: isHovered
                  ? `translateY(0) scale(${1 - depth * 0.02})`
                  : `translateY(0) scale(${1 - depth * 0.04})`,
                zIndex: 30 - depth,
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.92))',
                borderColor: isHovered ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                boxShadow: '0 15px 30px -10px rgba(0, 0, 0, 0.5)',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                    {notif.senderName ? notif.senderName.charAt(0) : <Bell className="w-3 h-3 text-sky-400" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-200 truncate">{notif.title}</p>
                    <p className="text-[10px] text-slate-400 truncate">{notif.message}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-slate-400">{notif.createdAt}</span>
                  {isHovered && (
                    <button
                      onClick={(e) => handleDismiss(notif.id, e)}
                      className="p-0.5 rounded text-slate-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Action buttons if hovered */}
              {isHovered && notif.type === 'partner_request' && notif.partnerRequestId && (
                <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (onAcceptPartnerRequest) onAcceptPartnerRequest(notif.partnerRequestId!);
                      handleDismiss(notif.id);
                    }}
                    className="py-1 px-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-[10.5px] font-semibold rounded-md flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    Accept
                  </button>
                  <button
                    onClick={() => {
                      if (onDeclinePartnerRequest) onDeclinePartnerRequest(notif.partnerRequestId!);
                      handleDismiss(notif.id);
                    }}
                    className="py-1 px-2.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10.5px] rounded-md"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => {
                      if (onHoldPartnerRequest) onHoldPartnerRequest(notif.id);
                      handleDismiss(notif.id);
                    }}
                    className="py-1 px-2 bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10.5px] rounded-md"
                  >
                    Hold
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}


// ---------------------------------------------------------------------------
// 2. Dedicated Slide-Out Notifications Sidebar / Drawer
// ---------------------------------------------------------------------------
interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onAcceptPartnerRequest?: (requestId: string) => void;
  onDeclinePartnerRequest?: (requestId: string) => void;
  onHoldPartnerRequest?: (notificationId: string) => void;
  onOpenProject?: (projectId: string) => void;
  onDismissNotification?: (id: string) => void;
}

export function NotificationsDrawer({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onAcceptPartnerRequest,
  onDeclinePartnerRequest,
  onHoldPartnerRequest,
  onOpenProject,
  onDismissNotification,
}: NotificationsDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  useClickOutside(drawerRef, onClose, isOpen);

  const [activeFilter, setActiveFilter] = useState<'all' | 'friends' | 'projects' | 'held'>('all');

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifs = notifications.filter(n => {
    if (activeFilter === 'friends') return n.type === 'partner_request' || n.type === 'partner_accepted';
    if (activeFilter === 'projects') return n.type === 'project_invite';
    if (activeFilter === 'held') return n.held === true;
    return true;
  });

  return (
    <div 
      className="fixed inset-0 z-50 flex select-none pointer-events-auto bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        ref={drawerRef}
        onClick={(e) => e.stopPropagation()}
        className="relative left-12 w-88 sm:w-96 h-full border-r shadow-2xl flex flex-col z-50 animate-in slide-in-from-left duration-200"
        style={{
          backgroundColor: 'var(--ide-card-bg)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
      >
        {/* Drawer Header */}
        <div 
          className="p-4 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-dock-header)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm" style={{ color: 'var(--ide-text)' }}>Notifications</h2>
                {unreadCount > 0 && (
                  <span 
                    className="px-2 py-0.5 text-[10px] font-bold text-white rounded-full leading-none"
                    style={{ backgroundColor: 'var(--ide-accent)' }}
                  >
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-[11px] opacity-70" style={{ color: 'var(--ide-text-muted)' }}>
                Activity, invites & friend requests
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                onClick={() => {
                  onMarkAllRead();
                  Sound.playHapticPop();
                }}
                className="px-2.5 py-1 text-[11px] font-semibold text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 rounded-md transition-all flex items-center gap-1"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark read</span>
              </button>
            )}

            <button
              onClick={() => {
                onClose();
                Sound.playHapticPop();
              }}
              className="p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              style={{ color: 'var(--ide-text-muted)' }}
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="px-3 py-2 border-b flex items-center gap-1 overflow-x-auto text-[11px]" style={{ borderColor: 'var(--ide-border)' }}>
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1 rounded-full font-medium transition-all ${
              activeFilter === 'all'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-70 hover:opacity-100'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setActiveFilter('friends')}
            className={`px-2.5 py-1 rounded-full font-medium transition-all ${
              activeFilter === 'friends'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-70 hover:opacity-100'
            }`}
          >
            Friend Requests
          </button>
          <button
            onClick={() => setActiveFilter('projects')}
            className={`px-2.5 py-1 rounded-full font-medium transition-all ${
              activeFilter === 'projects'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-70 hover:opacity-100'
            }`}
          >
            Projects
          </button>
          <button
            onClick={() => setActiveFilter('held')}
            className={`px-2.5 py-1 rounded-full font-medium transition-all ${
              activeFilter === 'held'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-70 hover:opacity-100'
            }`}
          >
            Held
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
          {filteredNotifs.length === 0 ? (
            <div className="py-16 text-center text-xs opacity-50" style={{ color: 'var(--ide-text-muted)' }}>
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No notifications in this filter.</p>
            </div>
          ) : (
            filteredNotifs.map((n) => (
              <div
                key={n.id}
                className={`p-3.5 rounded-xl border transition-all duration-200 ${
                  n.read 
                    ? 'opacity-85 hover:opacity-100' 
                    : 'bg-sky-500/5 border-sky-500/30 shadow-sm'
                }`}
                style={{
                  backgroundColor: n.read ? 'var(--ide-card-bg)' : undefined,
                  borderColor: n.read ? 'var(--ide-border)' : undefined,
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Icon / Avatar */}
                  <div className="flex-shrink-0 mt-0.5">
                    {n.senderAvatar ? (
                      <img src={n.senderAvatar} alt="" className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10" />
                    ) : (
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-sky-500/10 text-sky-400">
                        {n.type === 'partner_request' && <UserPlus className="w-4 h-4" />}
                        {n.type === 'partner_accepted' && <UserCheck className="w-4 h-4 text-emerald-400" />}
                        {n.type === 'project_invite' && <FolderPlus className="w-4 h-4 text-indigo-400" />}
                        {n.type === 'mention' && <MessageSquare className="w-4 h-4 text-amber-400" />}
                        {n.type === 'system' && <Bell className="w-4 h-4" />}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-semibold text-[12px] truncate" style={{ color: 'var(--ide-text)' }}>
                        {n.title}
                      </p>
                      <span className="text-[10px] opacity-60 flex items-center gap-0.5" style={{ color: 'var(--ide-text-muted)' }}>
                        <Clock className="w-2.5 h-2.5" />
                        {n.createdAt}
                      </span>
                    </div>

                    <p className="text-[11.5px] mt-1 leading-relaxed opacity-80" style={{ color: 'var(--ide-text-muted)' }}>
                      {n.message}
                    </p>

                    {/* Partner request actions: Accept, Reject, Hold */}
                    {(n.type === 'partner_request' || n.partnerRequestId) && (
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (n.partnerRequestId && onAcceptPartnerRequest) {
                              onAcceptPartnerRequest(n.partnerRequestId);
                            }
                            Sound.playHapticPop();
                          }}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold transition-all shadow-sm flex items-center gap-1 active:scale-95"
                        >
                          <Check className="w-3 h-3" />
                          <span>Accept</span>
                        </button>
                        <button
                          onClick={() => {
                            if (n.partnerRequestId && onDeclinePartnerRequest) {
                              onDeclinePartnerRequest(n.partnerRequestId);
                            }
                            Sound.playHapticPop();
                          }}
                          className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-[11px] font-medium transition-all active:scale-95"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => {
                            if (onHoldPartnerRequest) onHoldPartnerRequest(n.id);
                            Sound.playHapticPop();
                          }}
                          className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-medium transition-all active:scale-95"
                        >
                          Hold
                        </button>
                      </div>
                    )}

                    {/* Project Invite action */}
                    {n.type === 'project_invite' && n.projectId && (
                      <div className="mt-2.5">
                        <button
                          onClick={() => onOpenProject && onOpenProject(n.projectId!)}
                          className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          <span>Open Project</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Dismiss */}
                  {onDismissNotification && (
                    <button
                      onClick={() => onDismissNotification(n.id)}
                      className="opacity-40 hover:opacity-100 p-1 rounded transition-opacity"
                      style={{ color: 'var(--ide-text-muted)' }}
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Backward-compatible alias for existing imports
export const NotificationsPopover = NotificationsDrawer;

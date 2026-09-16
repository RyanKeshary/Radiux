'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  Search,
  Filter,
  Trash2,
  ChevronRight
} from 'lucide-react';
import { AppNotification } from './NotificationsPopover';
import { triggerHaptic } from '@/lib/haptics';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onAcceptPartnerRequest?: (requestId: string) => void;
  onDeclinePartnerRequest?: (requestId: string) => void;
  onHoldPartnerRequest?: (requestId: string) => void;
  onOpenProject?: (projectId: string) => void;
  onDismissNotification?: (id: string) => void;
  onClearAll?: () => void;
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
  onClearAll,
}: NotificationsDrawerProps) {
  const [filterTab, setFilterTab] = useState<'all' | 'requests' | 'invites' | 'mentions'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  const filtered = notifications.filter((n) => {
    if (filterTab === 'requests' && n.type !== 'partner_request' && n.type !== 'partner_accepted') return false;
    if (filterTab === 'invites' && n.type !== 'project_invite') return false;
    if (filterTab === 'mentions' && n.type !== 'mention') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        (n.senderName && n.senderName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200 select-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={() => {
          triggerHaptic('light');
          onClose();
        }}
      />

      {/* Slide-over Drawer Panel */}
      <div 
        ref={drawerRef}
        style={{
          backgroundColor: 'var(--ide-sidebar)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
        className="relative w-full max-w-md h-full border-l shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-250 ease-out"
      >
        {/* Header */}
        <div 
          className="p-4 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--ide-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm">Notifications</h2>
                {unreadCount > 0 && (
                  <span 
                    className="px-2 py-0.5 text-[10px] font-bold text-white rounded-full leading-none"
                    style={{ backgroundColor: 'var(--ide-accent)' }}
                  >
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-[11px] opacity-60">Team alerts, requests & activity</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                onClick={() => {
                  triggerHaptic('light');
                  onMarkAllRead();
                }}
                className="px-2.5 py-1 rounded text-xs text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 transition-colors flex items-center gap-1"
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark read</span>
              </button>
            )}

            <button
              onClick={() => {
                triggerHaptic('light');
                onClose();
              }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Pills & Search */}
        <div className="p-3 border-b space-y-2" style={{ borderColor: 'var(--ide-border)' }}>
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 opacity-40" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none border focus:ring-1 focus:ring-sky-500 transition-all"
              style={{
                backgroundColor: 'var(--ide-input-bg)',
                borderColor: 'var(--ide-border)',
                color: 'var(--ide-text)',
              }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'all', label: 'All' },
              { id: 'requests', label: 'Friend Requests' },
              { id: 'invites', label: 'Invites' },
              { id: 'mentions', label: 'Mentions' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  triggerHaptic('light');
                  setFilterTab(tab.id as any);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  filterTab === tab.id
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-white/5 hover:bg-white/10 opacity-70 hover:opacity-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/5 p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center opacity-40 gap-2">
              <Bell className="w-10 h-10 stroke-[1.5]" />
              <p className="text-xs">No notifications in this view</p>
            </div>
          ) : (
            filtered.map((n) => (
              <div
                key={n.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  n.read 
                    ? 'opacity-70 hover:opacity-100 bg-white/[0.02] border-transparent' 
                    : 'bg-sky-500/[0.06] border-sky-500/20 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {n.type === 'partner_request' && <UserPlus className="w-3.5 h-3.5 text-sky-400" />}
                    {n.type === 'partner_accepted' && <UserCheck className="w-3.5 h-3.5 text-emerald-400" />}
                    {n.type === 'project_invite' && <FolderPlus className="w-3.5 h-3.5 text-indigo-400" />}
                    {n.type === 'mention' && <MessageSquare className="w-3.5 h-3.5 text-amber-400" />}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold text-xs truncate" style={{ color: 'var(--ide-text)' }}>
                        {n.title}
                      </h4>
                      <span className="text-[10px] opacity-50 flex-shrink-0">{n.createdAt}</span>
                    </div>

                    <p className="text-[11.5px] mt-1 leading-relaxed opacity-75">
                      {n.message}
                    </p>

                    {/* Friend Request 3-Action Buttons */}
                    {n.type === 'partner_request' && n.partnerRequestId && (
                      <div className="mt-2.5 flex items-center gap-2">
                        {/* 1. Accept */}
                        <button
                          onClick={() => {
                            triggerHaptic('success');
                            if (onAcceptPartnerRequest) onAcceptPartnerRequest(n.partnerRequestId!);
                          }}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[11px] font-medium flex items-center gap-1 shadow-sm transition-all active:scale-[0.97]"
                        >
                          <Check className="w-3 h-3" />
                          <span>Accept</span>
                        </button>

                        {/* 2. Reject */}
                        <button
                          onClick={() => {
                            triggerHaptic('warning');
                            if (onDeclinePartnerRequest) onDeclinePartnerRequest(n.partnerRequestId!);
                          }}
                          className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-md text-[11px] font-medium flex items-center gap-1 transition-all active:scale-[0.97]"
                        >
                          <X className="w-3 h-3" />
                          <span>Reject</span>
                        </button>

                        {/* 3. Hold / Ignore */}
                        <button
                          onClick={() => {
                            triggerHaptic('light');
                            if (onHoldPartnerRequest) {
                              onHoldPartnerRequest(n.partnerRequestId!);
                            } else if (onDismissNotification) {
                              onDismissNotification(n.id);
                            }
                          }}
                          className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 rounded-md text-[11px] font-medium flex items-center gap-1 transition-all"
                          title="Hold/Ignore without declining"
                        >
                          <Clock className="w-3 h-3" />
                          <span>Hold</span>
                        </button>
                      </div>
                    )}

                    {/* Project Invite Action */}
                    {n.type === 'project_invite' && n.projectId && (
                      <div className="mt-2.5">
                        <button
                          onClick={() => {
                            triggerHaptic('medium');
                            if (onOpenProject) onOpenProject(n.projectId!);
                          }}
                          className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-[11px] font-medium flex items-center gap-1 shadow-sm transition-all"
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
                      onClick={() => {
                        triggerHaptic('light');
                        onDismissNotification(n.id);
                      }}
                      className="text-neutral-500 hover:text-neutral-300 p-1 rounded transition-colors"
                      title="Dismiss notification"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div 
            className="p-3 border-t flex items-center justify-between text-xs"
            style={{ borderColor: 'var(--ide-border)' }}
          >
            <span className="opacity-50">{notifications.length} total notifications</span>
            {onClearAll && (
              <button
                onClick={() => {
                  triggerHaptic('light');
                  onClearAll();
                }}
                className="text-rose-400 hover:text-rose-300 flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear all</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

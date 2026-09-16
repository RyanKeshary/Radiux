'use client';

import React, { useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { 
  Bell, 
  Check, 
  X, 
  UserCheck, 
  UserPlus, 
  FolderPlus, 
  MessageSquare, 
  CheckCheck,
  ExternalLink
} from 'lucide-react';

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

interface NotificationsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onAcceptPartnerRequest?: (requestId: string) => void;
  onDeclinePartnerRequest?: (requestId: string) => void;
  onOpenProject?: (projectId: string) => void;
  onDismissNotification?: (id: string) => void;
}

export function NotificationsPopover({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onAcceptPartnerRequest,
  onDeclinePartnerRequest,
  onOpenProject,
  onDismissNotification,
}: NotificationsPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  useClickOutside(popoverRef, onClose, isOpen);

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div 
      ref={popoverRef}
      className="absolute top-12 left-12 z-50 w-80 max-h-[460px] rounded-lg shadow-2xl border flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      style={{
        backgroundColor: 'var(--ide-card-bg)',
        borderColor: 'var(--ide-border)',
        color: 'var(--ide-text)',
      }}
    >
      {/* Header */}
      <div 
        className="px-3 py-2.5 border-b flex items-center justify-between select-none"
        style={{ borderColor: 'var(--ide-border)' }}
      >
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-sky-400" />
          <span className="font-semibold text-xs" style={{ color: 'var(--ide-text)' }}>Notifications</span>
          {unreadCount > 0 && (
            <span 
              className="px-1.5 py-0.2 text-[10px] font-bold text-white rounded-full leading-none"
              style={{ backgroundColor: 'var(--ide-accent)' }}
            >
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-[10px] text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-0.5"
              title="Mark all notifications as read"
            >
              <CheckCheck className="w-3 h-3" />
              <span>Mark read</span>
            </button>
          )}

          <button
            onClick={onClose}
            style={{ color: 'var(--ide-text-muted)' }}
            className="p-1 rounded hover:opacity-80 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Notification Items List */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/5 text-xs">
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-xs" style={{ color: 'var(--ide-text-muted)' }}>
            <Bell className="w-6 h-6 mx-auto mb-2 opacity-30" />
            <p>No notifications yet.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`p-3 transition-colors ${
                n.read ? 'opacity-70 hover:opacity-100' : 'bg-sky-500/5'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {/* Icon */}
                <div className="mt-0.5 flex-shrink-0">
                  {n.type === 'partner_request' && (
                    <UserPlus className="w-4 h-4 text-sky-400" />
                  )}
                  {n.type === 'partner_accepted' && (
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                  )}
                  {n.type === 'project_invite' && (
                    <FolderPlus className="w-4 h-4 text-indigo-400" />
                  )}
                  {n.type === 'mention' && (
                    <MessageSquare className="w-4 h-4 text-amber-400" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-[11.5px] truncate" style={{ color: 'var(--ide-text)' }}>{n.title}</p>
                    <span className="text-[10px]" style={{ color: 'var(--ide-text-muted)' }}>{n.createdAt}</span>
                  </div>
                  <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--ide-text-muted)' }}>{n.message}</p>

                  {/* Actions for Partner Requests */}
                  {n.type === 'partner_request' && n.partnerRequestId && (
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => onAcceptPartnerRequest && onAcceptPartnerRequest(n.partnerRequestId!)}
                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-medium transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => onDeclinePartnerRequest && onDeclinePartnerRequest(n.partnerRequestId!)}
                        style={{
                          backgroundColor: 'var(--ide-input-bg)',
                          borderColor: 'var(--ide-border)',
                          color: 'var(--ide-text)',
                        }}
                        className="px-2 py-0.5 rounded text-[11px] border transition-colors hover:opacity-80"
                      >
                        Decline
                      </button>
                    </div>
                  )}

                  {/* Actions for Project Invites */}
                  {n.type === 'project_invite' && n.projectId && (
                    <div className="mt-2">
                      <button
                        onClick={() => onOpenProject && onOpenProject(n.projectId!)}
                        className="px-2 py-0.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-[11px] font-medium transition-colors flex items-center gap-1"
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
                    style={{ color: 'var(--ide-text-muted)' }}
                    className="hover:opacity-80 p-0.5"
                    title="Dismiss"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

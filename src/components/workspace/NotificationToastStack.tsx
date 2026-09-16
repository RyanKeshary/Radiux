'use client';

import React, { useState } from 'react';
import { 
  UserPlus, 
  UserCheck, 
  FolderPlus, 
  MessageSquare, 
  Check, 
  X, 
  Clock, 
  ExternalLink,
  ChevronRight,
  Shield,
  Bell
} from 'lucide-react';
import { AppNotification } from './NotificationsPopover';
import { triggerHaptic } from '@/lib/haptics';

interface NotificationToastStackProps {
  notifications: AppNotification[];
  onAcceptPartnerRequest?: (requestId: string) => void;
  onDeclinePartnerRequest?: (requestId: string) => void;
  onHoldPartnerRequest?: (requestId: string) => void;
  onOpenProject?: (projectId: string) => void;
  onDismissNotification?: (id: string) => void;
  onOpenDrawer?: () => void;
}

export function NotificationToastStack({
  notifications,
  onAcceptPartnerRequest,
  onDeclinePartnerRequest,
  onHoldPartnerRequest,
  onOpenProject,
  onDismissNotification,
  onOpenDrawer,
}: NotificationToastStackProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Only consider active/recent unread notifications for the floating toast stack
  const activeNotifications = notifications.filter(n => !n.read).slice(0, 3);

  if (activeNotifications.length === 0) return null;

  const topNotification = activeNotifications[0];
  const stackedCards = isHovered ? activeNotifications : [topNotification];

  return (
    <aside 
      aria-label="Recent notifications"
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none select-none"
    >
      <div 
        className="pointer-events-auto flex flex-col items-end gap-2 transition-all duration-300 ease-out"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Render stacked cards */}
        {stackedCards.map((n, index) => {
          // Dynamic 3D stacked offsets when not hovered vs expanded glassmorphic tiles when hovered
          const offsetStyle = isHovered
            ? {
                transform: 'translateY(0) scale(1)',
                opacity: 1,
                marginBottom: '4px',
              }
            : {
                transform: `translateY(${index * -10}px) scale(${1 - index * 0.05})`,
                opacity: index === 0 ? 1 : Math.max(0, 0.7 - index * 0.3),
                zIndex: 30 - index,
              };

          return (
            <div
              key={n.id}
              style={{
                ...offsetStyle,
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                backgroundColor: 'rgba(23, 27, 38, 0.82)',
                borderColor: 'rgba(255, 255, 255, 0.12)',
              }}
              className={`w-84 sm:w-96 rounded-2xl border p-4 shadow-2xl transition-all duration-300 ease-out text-xs text-white relative overflow-hidden group ${
                index === 0 ? 'ring-1 ring-sky-500/30 shadow-sky-500/10' : ''
              }`}
            >
              {/* Subtle glass gradient sheen */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20 pointer-events-none" />

              {/* Notification Header */}
              <div className="flex items-start justify-between gap-3 relative z-10">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
                    {n.type === 'partner_request' && <UserPlus className="w-4 h-4 text-white" />}
                    {n.type === 'partner_accepted' && <UserCheck className="w-4 h-4 text-emerald-200" />}
                    {n.type === 'project_invite' && <FolderPlus className="w-4 h-4 text-sky-200" />}
                    {n.type === 'mention' && <MessageSquare className="w-4 h-4 text-amber-200" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-white truncate max-w-[170px]">
                        {n.senderName || n.title}
                      </span>
                      {n.type === 'partner_request' && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-medium bg-sky-500/20 text-sky-300 border border-sky-500/30">
                          Friend Request
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-400">{n.createdAt}</span>
                  </div>
                </div>

                {/* Dismiss Button */}
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    if (onDismissNotification) onDismissNotification(n.id);
                  }}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Message Content */}
              <p className="mt-2 text-neutral-300 text-[11.5px] leading-relaxed relative z-10">
                {n.message}
              </p>

              {/* 3 Explicit Action Buttons for Friend / Partner Requests */}
              {n.type === 'partner_request' && n.partnerRequestId && (
                <div className="mt-3 flex items-center gap-2 relative z-10 pt-2 border-t border-white/10">
                  {/* 1. Accept */}
                  <button
                    onClick={() => {
                      triggerHaptic('success');
                      if (onAcceptPartnerRequest) onAcceptPartnerRequest(n.partnerRequestId!);
                    }}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium text-[11px] flex items-center justify-center gap-1 shadow-md shadow-emerald-900/30 transition-all active:scale-[0.97]"
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
                    className="py-1.5 px-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-medium text-[11px] flex items-center justify-center gap-1 transition-all active:scale-[0.97]"
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
                    className="py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 font-medium text-[11px] flex items-center justify-center gap-1 transition-all active:scale-[0.97]"
                    title="Hold/Ignore without declining"
                  >
                    <Clock className="w-3 h-3 text-neutral-400" />
                    <span>Hold</span>
                  </button>
                </div>
              )}

              {/* Action for Project Invites */}
              {n.type === 'project_invite' && n.projectId && (
                <div className="mt-3 flex items-center gap-2 relative z-10 pt-2 border-t border-white/10">
                  <button
                    onClick={() => {
                      triggerHaptic('medium');
                      if (onOpenProject) onOpenProject(n.projectId!);
                    }}
                    className="py-1.5 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-medium text-[11px] flex items-center gap-1.5 shadow-md shadow-sky-900/30 transition-all active:scale-[0.97]"
                  >
                    <span>Open Project</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Stack Indicator on Hover */}
        {isHovered && activeNotifications.length > 1 && (
          <button
            onClick={() => {
              triggerHaptic('light');
              if (onOpenDrawer) onOpenDrawer();
            }}
            className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/40 border border-white/10 backdrop-blur-md transition-colors"
          >
            <Bell className="w-3 h-3" />
            <span>View all in Notification Sidebar</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </aside>
  );
}

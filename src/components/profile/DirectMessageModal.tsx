'use client';

import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, DirectMessage } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { useAuth } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { soundManager } from '@/lib/sound';
import { MessageSquare, X, Send, Loader2 } from 'lucide-react';

interface DirectMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: UserProfile | any;
  user?: UserProfile | null;
}

export function DirectMessageModal({
  isOpen,
  onClose,
  targetUser,
  user: propUser,
}: DirectMessageModalProps) {
  const { user: authUser } = useAuth();
  const user = propUser || authUser;
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Initial Load & Background Polling Sync
  useEffect(() => {
    if (!isOpen || !user) return;
    let isMounted = true;

    const loadMessages = async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const history = await DataService.getDirectMessages(user.id, targetUser.id);
        if (isMounted) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newOnes = history.filter((m) => !existingIds.has(m.id));
            if (newOnes.length > 0) {
              const merged = [...prev, ...newOnes].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              return merged;
            }
            if (prev.length === 0) return history;
            return prev;
          });
          await DataService.markDirectMessagesRead(targetUser.id, user.id);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted && showLoading) {
          setLoading(false);
        }
      }
    };

    loadMessages(true);

    // Fast sync interval every 2.5 seconds
    const interval = setInterval(() => loadMessages(false), 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, user, targetUser.id]);

  const channelRef = useRef<any>(null);

  // 2. Real-time Supabase Broadcast for instant message delivery (< 50ms)
  useEffect(() => {
    if (!isOpen || !user) return;

    // A. Listen for window-level DM events dispatched from global notifications
    const handleDmEvent = (e: any) => {
      const payload = e.detail;
      if (payload && (payload.sender_id === targetUser.id || payload.sender_id === user.id)) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.id)) return prev;
          return [...prev, payload];
        });
        if (payload.sender_id === targetUser.id) {
          soundManager.playNotification();
          DataService.markDirectMessagesRead(targetUser.id, user.id);
        }
      }
    };
    window.addEventListener('radiux-dm-received', handleDmEvent);

    // B. Supabase direct room subscription
    if (isSupabaseConfigured && supabase) {
      const pairKey = [user.id, targetUser.id].sort().join('_');
      const channel = supabase.channel(`radiux_dm_${pairKey}`);
      channelRef.current = channel;

      channel.on('broadcast', { event: 'dm_message' }, ({ payload }) => {
        if (payload && (payload.sender_id === targetUser.id || payload.sender_id === user.id)) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.id)) return prev;
            return [...prev, payload];
          });
          if (payload.sender_id === targetUser.id) {
            soundManager.playNotification();
            DataService.markDirectMessagesRead(targetUser.id, user.id);
          }
        }
      });

      channel.subscribe();
    }

    return () => {
      window.removeEventListener('radiux-dm-received', handleDmEvent);
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [isOpen, user, targetUser.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!isOpen) return null;

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || !inputValue.trim() || sending) return;
    const content = inputValue.trim();
    setInputValue('');
    setSending(true);
    try {
      const newMsg = await DataService.sendDirectMessage(user, targetUser.id, content);
      soundManager.playSuccess();
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      // Broadcast immediately to counterparty via persistent channel
      if (channelRef.current) {
        try {
          channelRef.current.send({
            type: 'broadcast',
            event: 'dm_message',
            payload: newMsg,
          });
        } catch (e) {}
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in select-none p-4"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md rounded-xl border shadow-2xl overflow-hidden flex flex-col h-[520px]"
        style={{
          backgroundColor: 'var(--ide-card-bg)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="p-3.5 border-b flex items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--ide-dock-header)',
            borderColor: 'var(--ide-border)',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow flex-shrink-0 overflow-hidden">
              {targetUser.avatar_url ? (
                <img src={targetUser.avatar_url} alt={targetUser.full_name} className="w-full h-full object-cover" />
              ) : (
                targetUser.full_name?.charAt(0).toUpperCase() || 'U'
              )}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-xs truncate" style={{ color: 'var(--ide-text)' }}>
                {targetUser.full_name}
              </div>
              <div className="text-[10.5px] opacity-70 truncate">
                @{targetUser.username || targetUser.id}
              </div>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10"
            style={{ color: 'var(--ide-text-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Thread */}
        <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full text-xs text-neutral-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
              <span>Loading messages...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2">
              <MessageSquare className="w-8 h-8 text-neutral-500 opacity-40" />
              <p className="text-xs font-medium" style={{ color: 'var(--ide-text-muted)' }}>
                Start a conversation with {targetUser.full_name.split(' ')[0]}.
              </p>
              <p className="text-[11px] text-neutral-500">
                Direct messages are private between you and this developer.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isMine = m.sender_id === user?.id;
              return (
                <div 
                  key={m.id} 
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-2.5 rounded-xl text-xs shadow-sm leading-relaxed ${
                      isMine 
                        ? 'text-white rounded-br-none' 
                        : 'border rounded-bl-none'
                    }`}
                    style={{
                      backgroundColor: isMine ? 'var(--ide-accent)' : 'var(--ide-dock-header)',
                      borderColor: isMine ? undefined : 'var(--ide-border)',
                      color: isMine ? '#ffffff' : 'var(--ide-text)',
                    }}
                  >
                    {m.content}
                  </div>
                  <span className="text-[9.5px] text-neutral-500 mt-1 px-1">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Input Bar */}
        <form 
          onSubmit={handleSendMessage}
          className="p-3 border-t flex items-center gap-2"
          style={{
            backgroundColor: 'var(--ide-dock-header)',
            borderColor: 'var(--ide-border)',
          }}
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Message @${targetUser.username || targetUser.full_name}...`}
            className="flex-1 p-2 text-xs rounded-lg border outline-none focus:ring-1 focus:ring-sky-500"
            style={{
              backgroundColor: 'var(--ide-input-bg)',
              borderColor: 'var(--ide-border)',
              color: 'var(--ide-text)',
            }}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || sending}
            className="p-2 rounded-lg text-white disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: 'var(--ide-accent)' }}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}

export function GlobalDirectMessageModal({ currentUser }: { currentUser: any }) {
  const [targetUser, setTargetUser] = useState<any | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleOpen = (e: any) => {
      if (e.detail?.targetUser) {
        setTargetUser(e.detail.targetUser);
        setIsOpen(true);
      }
    };
    window.addEventListener('open-direct-message', handleOpen);
    return () => window.removeEventListener('open-direct-message', handleOpen);
  }, []);

  if (!isOpen || !targetUser || !currentUser) return null;

  return (
    <DirectMessageModal
      isOpen={isOpen}
      onClose={() => {
        setIsOpen(false);
        setTargetUser(null);
      }}
      user={currentUser}
      targetUser={targetUser}
    />
  );
}

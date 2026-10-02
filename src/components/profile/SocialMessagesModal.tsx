'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { 
  MessageSquare, 
  Search, 
  X, 
  UserPlus, 
  Clock, 
  Sparkles, 
  Send,
  Loader2,
  Users
} from 'lucide-react';
import { soundManager } from '@/lib/sound';

interface ConversationItem {
  peer: UserProfile;
  lastMessage: {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    created_at: string;
    read: boolean;
  };
  unreadCount: number;
}

interface SocialMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSelectUser?: (user: UserProfile) => void;
}

export function SocialMessagesModal({
  isOpen,
  onClose,
  currentUser,
  onSelectUser,
}: SocialMessagesModalProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [partners, setPartners] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');

  const loadData = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [convList, partnerList] = await Promise.all([
        DataService.getConversations(currentUser.id),
        DataService.getCodingPartners(currentUser.id),
      ]);
      setConversations(convList || []);
      const activePartners = (partnerList || [])
        .filter((p) => p.status === 'accepted' && p.profile)
        .map((p) => p.profile!);
      setPartners(activePartners);
    } catch (e) {
      console.error(e);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !currentUser) return;
    loadData(true);

    const interval = setInterval(() => loadData(false), 3000);

    const handleDm = () => loadData(false);
    window.addEventListener('radiux-dm-received', handleDm);

    return () => {
      clearInterval(interval);
      window.removeEventListener('radiux-dm-received', handleDm);
    };
  }, [isOpen, currentUser.id]);

  const handleStartChat = (targetUser: UserProfile) => {
    soundManager.playSuccess();
    onClose();
    if (onSelectUser) {
      onSelectUser(targetUser);
    } else {
      window.dispatchEvent(
        new CustomEvent('open-direct-message', {
          detail: { targetUser },
        })
      );
    }
  };

  const formatRelativeTime = (iso: string) => {
    try {
      const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (diffSec < 60) return 'just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
      if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d`;
      return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const filteredConversations = useMemo(() => {
    let list = conversations;
    if (activeTab === 'unread') {
      list = list.filter((c) => c.unreadCount > 0);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.peer.full_name?.toLowerCase().includes(q) ||
          c.peer.username?.toLowerCase().includes(q) ||
          c.peer.email?.toLowerCase().includes(q) ||
          c.lastMessage?.content?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [conversations, activeTab, searchQuery]);

  // Partners who haven't been talked to yet
  const newPartnerSuggestions = useMemo(() => {
    const talkedToIds = new Set(conversations.map((c) => c.peer.id));
    return partners.filter((p) => !talkedToIds.has(p.id));
  }, [conversations, partners]);

  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  }, [conversations]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in select-none">
      <div 
        className="w-full max-w-xl max-h-[85vh] rounded-2xl shadow-2xl border flex flex-col overflow-hidden text-xs"
        style={{
          backgroundColor: 'var(--ide-card-bg)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
      >
        {/* Instagram-style Header */}
        <div 
          className="px-5 py-4 border-b flex items-center justify-between bg-white/[0.02]"
          style={{ borderColor: 'var(--ide-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-amber-400 p-[1.5px] flex items-center justify-center">
              <div 
                className="w-full h-full rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--ide-card-bg)' }}
              >
                <MessageSquare className="w-4 h-4 text-pink-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--ide-text)' }}>
                  Direct Messages
                </h2>
                {totalUnreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-sky-500 text-[10px] font-bold text-white">
                    {totalUnreadCount} new
                  </span>
                )}
              </div>
              <p className="text-[11px]" style={{ color: 'var(--ide-text-muted)' }}>
                @{currentUser.username || currentUser.email.split('@')[0]}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border hover:bg-white/10 transition-colors"
            style={{ borderColor: 'var(--ide-border)', color: 'var(--ide-text-muted)' }}
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Tabs Bar */}
        <div className="p-3 border-b space-y-2.5" style={{ borderColor: 'var(--ide-border)' }}>
          <div 
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs shadow-inner"
            style={{
              backgroundColor: 'var(--ide-input-bg)',
              borderColor: 'var(--ide-border)',
            }}
          >
            <Search className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations, friends, or messages..."
              className="bg-transparent flex-1 focus:outline-none text-xs"
              style={{ color: 'var(--ide-text)' }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                activeTab === 'all'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-400'
              }`}
            >
              All Messages ({conversations.length})
            </button>
            <button
              onClick={() => setActiveTab('unread')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                activeTab === 'unread'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-400'
              }`}
            >
              <span>Unread</span>
              {totalUnreadCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {totalUnreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Stories / Quick Partners Tray (Instagram-style circular avatar scroll) */}
        {partners.length > 0 && (
          <div 
            className="px-4 py-2.5 border-b overflow-x-auto flex items-center gap-4 scrollbar-none"
            style={{ borderColor: 'var(--ide-border)', backgroundColor: 'rgba(0,0,0,0.1)' }}
          >
            {partners.map((partner) => (
              <button
                key={partner.id}
                onClick={() => handleStartChat(partner)}
                className="flex flex-col items-center gap-1 group flex-shrink-0 focus:outline-none"
                title={`Chat with ${partner.full_name || partner.username}`}
              >
                <div className="relative">
                  <div className="w-11 h-11 rounded-full p-[2px] bg-gradient-to-tr from-sky-500 to-indigo-500 group-hover:scale-105 transition-transform shadow-sm">
                    {partner.avatar_url ? (
                      <img
                        src={partner.avatar_url}
                        alt=""
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-neutral-800 flex items-center justify-center font-bold text-sky-300 text-xs">
                        {(partner.full_name || partner.username || 'P').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-neutral-900" />
                </div>
                <span className="text-[10px] font-medium max-w-[56px] truncate text-neutral-300 group-hover:text-white">
                  {partner.full_name?.split(' ')[0] || partner.username || 'Partner'}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04] p-1">
          {loading && conversations.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-400">
              <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
              <span>Loading messages...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="py-12 text-center text-neutral-400 space-y-3 px-4">
              <div className="w-12 h-12 rounded-full bg-white/5 mx-auto flex items-center justify-center text-neutral-500">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold text-neutral-200">No conversations yet</p>
                <p className="text-[11px] text-neutral-500 mt-1 max-w-sm mx-auto">
                  {searchQuery 
                    ? `No messages matching "${searchQuery}"`
                    : 'Start a direct chat with your coding partners or collaborators!'}
                </p>
              </div>

              {newPartnerSuggestions.length > 0 && (
                <div className="pt-2 text-left max-w-sm mx-auto">
                  <p className="text-[11px] font-semibold text-neutral-400 mb-2">Connect with partners:</p>
                  <div className="space-y-1">
                    {newPartnerSuggestions.slice(0, 3).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleStartChat(p)}
                        className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center font-bold text-xs">
                            {(p.full_name || p.username || 'P').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-neutral-200">{p.full_name || p.username}</p>
                            <p className="text-[10px] text-neutral-500">@{p.username || p.email?.split('@')[0]}</p>
                          </div>
                        </div>
                        <button className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-medium flex items-center gap-1">
                          <Send className="w-3 h-3" />
                          <span>Chat</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isUnread = conv.unreadCount > 0;
              const isMine = conv.lastMessage?.sender_id === currentUser.id;

              return (
                <div
                  key={conv.peer.id}
                  onClick={() => handleStartChat(conv.peer)}
                  className={`p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                    isUnread
                      ? 'bg-sky-500/10 hover:bg-sky-500/15'
                      : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {conv.peer.avatar_url ? (
                        <img
                          src={conv.peer.avatar_url}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover border border-white/10"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-inner">
                          {(conv.peer.full_name || conv.peer.username || 'P').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-neutral-900" />
                    </div>

                    {/* Text Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-semibold truncate text-xs ${isUnread ? 'text-white' : 'text-neutral-200'}`}>
                          {conv.peer.full_name || conv.peer.username || 'Collaborator'}
                        </span>
                        <span className="text-[10px] text-neutral-500 truncate">
                          @{conv.peer.username || conv.peer.email?.split('@')[0]}
                        </span>
                      </div>

                      <p className={`text-[11px] truncate mt-0.5 ${
                        isUnread ? 'text-sky-300 font-medium' : 'text-neutral-400'
                      }`}>
                        {isMine && <span className="text-neutral-500 font-normal">You: </span>}
                        {conv.lastMessage?.content || 'Sent an attachment'}
                      </p>
                    </div>
                  </div>

                  {/* Meta / Unread Indicator */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {formatRelativeTime(conv.lastMessage?.created_at)}
                    </span>
                    {isUnread && (
                      <span className="px-1.5 py-0.2 rounded-full bg-sky-500 text-white font-bold text-[10px] min-w-[16px] text-center shadow-sm animate-pulse">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div 
          className="px-5 py-3 border-t flex items-center justify-between text-[11px] bg-white/[0.01]"
          style={{ borderColor: 'var(--ide-border)', color: 'var(--ide-text-muted)' }}
        >
          <span>Real-time instant DM delivery</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                window.dispatchEvent(new CustomEvent('open-developer-discovery'));
              }}
              className="text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Find Developers</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserProfile } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { useAuth } from '@/context/AuthContext';
import { 
  Search, 
  X, 
  Users, 
  ExternalLink, 
  MessageSquare, 
  UserPlus, 
  Check, 
  MapPin, 
  Briefcase, 
  Sparkles,
  Loader2 
} from 'lucide-react';

interface DeveloperDiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMessage?: (targetUser: UserProfile) => void;
}

export function DeveloperDiscoveryModal({
  isOpen,
  onClose,
  onOpenMessage,
}: DeveloperDiscoveryModalProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [developers, setDevelopers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [sentPartners, setSentPartners] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen) return;
    const fetchDevs = async () => {
      setLoading(true);
      try {
        const results = await DataService.searchDevelopers(query, user?.id);
        setDevelopers(results);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchDevs, 200);
    return () => clearTimeout(timer);
  }, [isOpen, query, user?.id]);

  if (!isOpen) return null;

  const handleSendPartnerRequest = async (targetDev: UserProfile) => {
    if (!user) return;
    try {
      await DataService.sendPartnerRequest(user, targetDev.id);
      setSentPartners((prev) => ({ ...prev, [targetDev.id]: true }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnsendPartnerRequest = async (targetDev: UserProfile) => {
    if (!user) return;
    try {
      const allPartners = await DataService.getCodingPartners(user.id);
      const match = allPartners.find(
        (p) => (p.requester_id === user.id && p.receiver_id === targetDev.id) || 
               (p.requester_id === targetDev.id && p.receiver_id === user.id)
      );
      if (match) {
        await DataService.unsendPartnerRequest(match.id);
      }
      setSentPartners((prev) => {
        const next = { ...prev };
        delete next[targetDev.id];
        return next;
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleNavigateToProfile = (usernameOrId: string) => {
    onClose();
    router.push(`/profile/${usernameOrId}`);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in select-none p-4"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl rounded-xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        style={{
          backgroundColor: 'var(--ide-card-bg)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div 
          className="p-4 border-b flex items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--ide-dock-header)',
            borderColor: 'var(--ide-border)',
          }}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-400" />
            <h3 className="font-semibold text-sm">Discover Developers</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10"
            style={{ color: 'var(--ide-text-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Search Input */}
        <div className="p-4 border-b" style={{ borderColor: 'var(--ide-border)' }}>
          <div 
            className="flex items-center gap-2 px-3 py-2 rounded-lg border focus-within:ring-1 focus-within:ring-sky-500"
            style={{
              backgroundColor: 'var(--ide-input-bg)',
              borderColor: 'var(--ide-border)',
            }}
          >
            <Search className="w-4 h-4 text-neutral-400" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search developers by name, @username, role, skills, or technologies..."
              className="w-full bg-transparent text-xs outline-none"
              style={{ color: 'var(--ide-text)' }}
            />
            {query && (
              <button onClick={() => setQuery('')} className="p-0.5 rounded hover:bg-white/10">
                <X className="w-3.5 h-3.5 text-neutral-400" />
              </button>
            )}
          </div>
        </div>

        {/* Results List */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-xs text-neutral-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
              <span>Searching developers...</span>
            </div>
          ) : developers.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Users className="w-8 h-8 text-neutral-500 mx-auto opacity-40" />
              <p className="text-xs font-medium" style={{ color: 'var(--ide-text-muted)' }}>
                No developers found matching &quot;{query}&quot;.
              </p>
              <p className="text-[11px] text-neutral-500">
                Try searching for technologies like &quot;TypeScript&quot;, &quot;React&quot;, or &quot;Go&quot;.
              </p>
            </div>
          ) : (
            developers.map((dev) => {
              const isReqSent = sentPartners[dev.id];
              return (
                <div
                  key={dev.id}
                  className="p-3.5 rounded-xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:border-sky-500/40"
                  style={{
                    backgroundColor: 'var(--ide-dock-header)',
                    borderColor: 'var(--ide-border)',
                  }}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow flex-shrink-0 overflow-hidden">
                      {dev.avatar_url ? (
                        <img src={dev.avatar_url} alt={dev.full_name} className="w-full h-full object-cover" />
                      ) : (
                        dev.full_name?.charAt(0).toUpperCase() || 'U'
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleNavigateToProfile(dev.username || dev.id)}
                          className="font-semibold text-xs hover:text-sky-400 hover:underline truncate"
                          style={{ color: 'var(--ide-text)' }}
                        >
                          {dev.full_name}
                        </button>
                        <span className="text-[10.5px] opacity-60">@{dev.username || dev.id}</span>
                      </div>

                      <div className="text-[11px] font-medium text-sky-400 flex items-center gap-1 mt-0.5">
                        <Briefcase className="w-3 h-3" />
                        <span>{dev.role || 'Software Engineer'}</span>
                        {dev.location && (
                          <span className="flex items-center gap-0.5 text-neutral-400 ml-1.5">
                            <MapPin className="w-2.5 h-2.5" />
                            {dev.location}
                          </span>
                        )}
                      </div>

                      {dev.bio && (
                        <p className="text-[11px] line-clamp-1 mt-1 opacity-75" style={{ color: 'var(--ide-text-muted)' }}>
                          {dev.bio}
                        </p>
                      )}

                      {/* Skills Tags */}
                      {dev.skills && dev.skills.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
                          {dev.skills.slice(0, 4).map((s, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono border"
                              style={{
                                borderColor: 'var(--ide-border)',
                                backgroundColor: 'var(--ide-card-bg)',
                                color: 'var(--ide-text-muted)',
                              }}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => handleNavigateToProfile(dev.username || dev.id)}
                      className="px-2.5 py-1 text-xs rounded border hover:bg-white/10 transition-colors flex items-center gap-1"
                      style={{ borderColor: 'var(--ide-border)' }}
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Profile</span>
                    </button>

                    {onOpenMessage && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenMessage(dev);
                        }}
                        className="p-1.5 rounded border hover:bg-white/10 transition-colors"
                        style={{ borderColor: 'var(--ide-border)' }}
                        title="Direct Message"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                      </button>
                    )}

                    {isReqSent ? (
                      <button
                        onClick={() => handleUnsendPartnerRequest(dev)}
                        className="px-2.5 py-1 text-xs font-medium rounded transition-all flex items-center gap-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 group"
                        title="Click to unsend friend request"
                      >
                        <X className="w-3 h-3 group-hover:scale-110 transition-transform" />
                        <span>Unsend</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSendPartnerRequest(dev)}
                        className="px-2.5 py-1 text-xs font-medium rounded transition-all flex items-center gap-1 text-white shadow-sm hover:brightness-110"
                        style={{
                          backgroundColor: 'var(--ide-accent)',
                        }}
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>Partner</span>
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

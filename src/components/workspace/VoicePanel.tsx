'use client';

import React from 'react';
import { Mic, MicOff, PhoneCall, PhoneOff, Users, Radio, Signal, Volume2, PanelBottom, PanelLeft } from 'lucide-react';
import { VoicePeer } from '@/lib/types';

interface VoicePanelProps {
  isInVoice: boolean;
  isMuted: boolean;
  voicePeers: VoicePeer[];
  connectionState: 'disconnected' | 'connecting' | 'connected';
  userName: string;
  userColor: string;
  onJoinVoice: () => void;
  onLeaveVoice: () => void;
  onToggleMute: () => void;
  onDockToBottom?: () => void;
  onDockToSidebar?: () => void;
  isSidebarMode?: boolean;
}

export function VoicePanel({
  isInVoice,
  isMuted,
  voicePeers,
  connectionState,
  userName,
  userColor,
  onJoinVoice,
  onLeaveVoice,
  onToggleMute,
  onDockToBottom,
  onDockToSidebar,
  isSidebarMode = false,
}: VoicePanelProps) {
  return (
    <div 
      className="flex flex-col h-full w-full p-4 overflow-hidden select-none"
      style={{
        backgroundColor: 'var(--ide-dock)',
        color: 'var(--ide-text)',
      }}
    >
      {/* Docking Bar */}
      {(onDockToBottom || onDockToSidebar) && (
        <div className="flex items-center justify-between pb-2.5 mb-3 border-b text-xs flex-shrink-0" style={{ borderColor: 'var(--ide-border)' }}>
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            Voice Space
          </span>
          {isSidebarMode && onDockToBottom && (
            <button
              onClick={onDockToBottom}
              className="p-1 px-2 rounded bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-colors flex items-center gap-1 text-[11px] font-medium"
              title="Open Voice in Bottom Terminal Dock"
            >
              <span>Dock to Terminal</span>
              <PanelBottom className="w-3 h-3" />
            </button>
          )}
          {!isSidebarMode && onDockToSidebar && (
            <button
              onClick={onDockToSidebar}
              className="p-1 px-2 rounded bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-colors flex items-center gap-1 text-[11px] font-medium"
              title="Move Voice to Left Sidebar"
            >
              <span>Move to Sidebar</span>
              <PanelLeft className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Top Banner / Controls */}
      <div 
        className="border rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg mb-4"
        style={{
          backgroundColor: 'var(--ide-card-bg)',
          borderColor: 'var(--ide-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              isInVoice
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-neutral-500/10 text-neutral-400 border border-neutral-500/20'
            }`}
          >
            {isInVoice ? (
              <Radio className="w-5 h-5 animate-pulse" />
            ) : (
              <PhoneCall className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold" style={{ color: 'var(--ide-text)' }}>Project Voice Channel</h3>
              {isInVoice && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  LIVE
                </span>
              )}
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--ide-text-muted)' }}>
              {isInVoice
                ? `${voicePeers.length + 1} participant${voicePeers.length + 1 === 1 ? '' : 's'} connected via peer-to-peer WebRTC.`
                : 'Join the voice room to speak with collaborators directly.'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {isInVoice ? (
            <>
              <button
                onClick={onToggleMute}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  isMuted
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30'
                    : 'hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                style={{
                  backgroundColor: isMuted ? undefined : 'var(--ide-input-bg)',
                  borderColor: isMuted ? undefined : 'var(--ide-border)',
                  color: isMuted ? undefined : 'var(--ide-text)',
                }}
              >
                {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              <button
                onClick={onLeaveVoice}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </>
          ) : (
            <button
              onClick={onJoinVoice}
              disabled={connectionState === 'connecting'}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors shadow-md"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>{connectionState === 'connecting' ? 'Connecting...' : 'Join Voice Call'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Participants Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ide-text-muted)' }}>
            Connected Collaborators
          </span>
          <span className="text-[11px]" style={{ color: 'var(--ide-text-muted)' }}>
            {isInVoice ? voicePeers.length + 1 : 0} in voice
          </span>
        </div>

        {isInVoice ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {/* Self Card */}
            <div 
              className="border rounded-xl p-3 flex items-center justify-between shadow"
              style={{
                backgroundColor: 'var(--ide-card-bg)',
                borderColor: 'var(--ide-border)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  style={{ backgroundColor: userColor }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-neutral-900 shadow-sm"
                >
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold" style={{ color: 'var(--ide-text)' }}>{userName}</span>
                    <span className="text-[10px] px-1 rounded bg-sky-500/20 text-sky-400 font-medium">
                      You
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                    <Signal className="w-2.5 h-2.5" /> Connected
                  </span>
                </div>
              </div>

              <div>
                {isMuted ? (
                  <div className="p-1 rounded-md bg-rose-500/20 text-rose-400" title="Microphone Muted">
                    <MicOff className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-400" title="Microphone Active">
                    <Volume2 className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            </div>

            {/* Remote Peers Cards */}
            {voicePeers.map((peer) => (
              <div
                key={peer.peerId}
                className="border rounded-xl p-3 flex items-center justify-between shadow"
                style={{
                  backgroundColor: 'var(--ide-card-bg)',
                  borderColor: 'var(--ide-border)',
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    style={{ backgroundColor: peer.userColor }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-neutral-900 shadow-sm"
                  >
                    {peer.userName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-xs font-semibold block" style={{ color: 'var(--ide-text)' }}>{peer.userName}</span>
                    <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                      <Signal className="w-2.5 h-2.5" /> Peer Audio
                    </span>
                  </div>
                </div>

                <div>
                  {peer.isMuted ? (
                    <div className="p-1 rounded-md bg-rose-500/20 text-rose-400" title="Peer Muted">
                      <MicOff className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-400" title="Speaking">
                      <Volume2 className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div 
            className="h-32 flex flex-col items-center justify-center border border-dashed rounded-xl text-center p-4"
            style={{
              borderColor: 'var(--ide-border)',
              backgroundColor: 'var(--ide-card-bg)',
            }}
          >
            <Radio className="w-6 h-6 mb-1" style={{ color: 'var(--ide-text-muted)' }} />
            <p className="text-xs font-medium" style={{ color: 'var(--ide-text)' }}>You are not currently in the voice call</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--ide-text-muted)' }}>Click "Join Voice Call" above to talk with your team in real time.</p>
          </div>
        )}
      </div>
    </div>
  );
}

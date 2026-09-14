'use client';

import React, { useState } from 'react';
import { TerminalPanel } from './TerminalPanel';
import { PreviewPanel } from './PreviewPanel';
import { ChatPanel } from './ChatPanel';
import { VoicePanel } from './VoicePanel';
import { ActivityFeed } from './ActivityFeed';
import { GitPanel } from './GitPanel';
import { 
  Terminal, 
  MonitorPlay, 
  Columns, 
  MessageSquare, 
  Mic, 
  Activity, 
  FolderGit2,
  X, 
  Maximize2, 
  Minimize2,
  PanelBottom,
  PanelRight,
  PanelLeft,
  Layout
} from 'lucide-react';
import { VoicePeer } from '@/lib/types';

export type DockOrientation = 'bottom' | 'right' | 'left' | 'fullscreen';

interface BottomDockProps {
  projectId: string;
  projectName?: string;
  isOpen: boolean;
  onClose: () => void;
  activeFileName?: string | null;
  userId: string;
  userName: string;
  userEmail?: string;
  userAvatar?: string;
  userColor: string;
  unreadCount: number;
  onClearUnread: () => void;
  onNewMessageReceived: () => void;
  onActivityEvent?: (details: string) => void;
  // Voice State passed down from Workspace
  isInVoice: boolean;
  isMuted: boolean;
  voicePeers: VoicePeer[];
  voiceConnectionState: 'disconnected' | 'connecting' | 'connected';
  onJoinVoice: () => void;
  onLeaveVoice: () => void;
  onToggleMute: () => void;
  // Orientation props
  orientation: DockOrientation;
  onChangeOrientation: (orientation: DockOrientation) => void;
  onOpenMediaInEditor?: (media: { name: string; url: string; type: 'image' | 'video' | 'audio' | 'file' }) => void;
}

export type DockTab = 'terminal' | 'preview' | 'git' | 'chat' | 'voice' | 'activity' | 'split';

export function BottomDock({
  projectId,
  projectName = 'Project',
  isOpen,
  onClose,
  activeFileName,
  userId,
  userName,
  userEmail,
  userAvatar,
  userColor,
  unreadCount,
  onClearUnread,
  onNewMessageReceived,
  onActivityEvent,
  isInVoice,
  isMuted,
  voicePeers,
  voiceConnectionState,
  onJoinVoice,
  onLeaveVoice,
  onToggleMute,
  orientation,
  onChangeOrientation,
  onOpenMediaInEditor,
}: BottomDockProps) {
  const [activeTab, setActiveTab] = useState<DockTab>('terminal');
  const [height, setHeight] = useState<number>(340);
  const [width, setWidth] = useState<number>(480);
  const [detectedPort, setDetectedPort] = useState<number>(5000);
  const [availablePorts, setAvailablePorts] = useState<number[]>([]);

  if (!isOpen) return null;

  const handlePortDetected = (port: number) => {
    setDetectedPort(port);
    setAvailablePorts((prev) => Array.from(new Set([...prev, port])));
    // Automatically switch or show preview when web server launches
    if (activeTab === 'terminal') {
      setActiveTab('split');
    }
  };

  // Determine container styling based on Chrome DevTools-like orientation
  let containerClasses = 'bg-[#181818] flex flex-col z-30 transition-all duration-150 shadow-2xl overflow-hidden ';
  let containerStyle: React.CSSProperties = {};

  if (orientation === 'bottom') {
    containerClasses += 'border-t border-[#3c3c3c] w-full';
    containerStyle = { height: `${height}px` };
  } else if (orientation === 'right') {
    containerClasses += 'border-l border-[#3c3c3c] h-full';
    containerStyle = { width: `${width}px` };
  } else if (orientation === 'left') {
    containerClasses += 'border-r border-[#3c3c3c] h-full';
    containerStyle = { width: `${width}px` };
  } else if (orientation === 'fullscreen') {
    containerClasses += 'fixed inset-0 w-full h-full z-50';
    containerStyle = {};
  }

  return (
    <div className={containerClasses} style={containerStyle}>
      {/* Dock Header */}
      <div className="h-9 px-3 bg-[#252526] border-b border-[#3c3c3c] flex items-center justify-between select-none flex-shrink-0">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {/* Terminal Tab */}
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'terminal'
                ? 'bg-[#181818] text-white border-t-2 border-t-sky-500'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Terminal</span>
          </button>

          {/* Web Preview Tab */}
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'preview'
                ? 'bg-[#181818] text-white border-t-2 border-t-sky-500'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <MonitorPlay className="w-3.5 h-3.5 text-sky-400" />
            <span>Preview</span>
            {availablePorts.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          {/* Level 5: Source Control / Git Tab */}
          <button
            onClick={() => setActiveTab('git')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'git'
                ? 'bg-[#181818] text-white border-t-2 border-t-indigo-500'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
            title="Git Version Control & Source Control"
          >
            <FolderGit2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Source Control</span>
          </button>

          {/* Split Tab */}
          <button
            onClick={() => setActiveTab('split')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'split'
                ? 'bg-[#181818] text-white border-t-2 border-t-sky-500'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
            title="Split view: Terminal and Live Preview side-by-side"
          >
            <Columns className="w-3.5 h-3.5 text-indigo-400" />
            <span>Split</span>
          </button>

          <div className="h-3.5 w-px bg-neutral-700 mx-0.5 flex-shrink-0" />

          {/* Level 4: Project Chat Tab */}
          <button
            onClick={() => {
              setActiveTab('chat');
              onClearUnread();
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'chat'
                ? 'bg-[#181818] text-white border-t-2 border-t-sky-400'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
            <span>Chat</span>
            {unreadCount > 0 && activeTab !== 'chat' && (
              <span className="px-1.5 py-0.2 rounded-full bg-sky-500 text-[10px] font-bold text-white leading-none">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Level 4: WebRTC Voice Tab */}
          <button
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'voice'
                ? 'bg-[#181818] text-white border-t-2 border-t-emerald-500'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Mic className={`w-3.5 h-3.5 ${isInVoice ? 'text-emerald-400' : 'text-neutral-400'}`} />
            <span>Voice</span>
            {isInVoice && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
            {voicePeers.length > 0 && (
              <span className="text-[10px] text-emerald-300 font-bold bg-emerald-500/20 px-1 rounded-full">
                {voicePeers.length + (isInVoice ? 1 : 0)}
              </span>
            )}
          </button>

          {/* Level 4: Project Activity Feed Tab */}
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'activity'
                ? 'bg-[#181818] text-white border-t-2 border-t-amber-400'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>Activity</span>
          </button>
        </div>

        {/* DevTools-Style Dock Orientation Switchers & Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="flex items-center bg-[#1e1e1e] p-0.5 rounded border border-[#333333] mr-1">
            <button
              onClick={() => onChangeOrientation('bottom')}
              title="Dock to bottom"
              className={`p-1 rounded transition-colors ${
                orientation === 'bottom'
                  ? 'bg-sky-600 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-[#2a2d2e]'
              }`}
            >
              <PanelBottom className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onChangeOrientation('right')}
              title="Dock to right"
              className={`p-1 rounded transition-colors ${
                orientation === 'right'
                  ? 'bg-sky-600 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-[#2a2d2e]'
              }`}
            >
              <PanelRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onChangeOrientation('left')}
              title="Dock to left"
              className={`p-1 rounded transition-colors ${
                orientation === 'left'
                  ? 'bg-sky-600 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-[#2a2d2e]'
              }`}
            >
              <PanelLeft className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onChangeOrientation(orientation === 'fullscreen' ? 'bottom' : 'fullscreen')}
              title={orientation === 'fullscreen' ? 'Exit fullscreen / restore dock' : 'Fullscreen / Undock into full screen'}
              className={`p-1 rounded transition-colors ${
                orientation === 'fullscreen'
                  ? 'bg-sky-600 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-[#2a2d2e]'
              }`}
            >
              {orientation === 'fullscreen' ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <button
            onClick={onClose}
            title="Close Dock"
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-[#333333] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Dock Content Body */}
      <div className="flex-1 w-full h-full min-h-0 overflow-hidden flex relative">
        {activeTab === 'terminal' && (
          <TerminalPanel 
            projectId={projectId} 
            onPortDetected={handlePortDetected} 
            activeFileName={activeFileName}
          />
        )}

        {activeTab === 'preview' && (
          <PreviewPanel 
            projectId={projectId} 
            initialPort={detectedPort} 
            availablePorts={availablePorts}
            activeFileName={activeFileName}
          />
        )}

        {activeTab === 'git' && (
          <GitPanel
            projectId={projectId}
            projectName={projectName}
            userName={userName}
            userEmail={userEmail}
            onActivityEvent={onActivityEvent}
          />
        )}

        {activeTab === 'chat' && (
          <ChatPanel
            projectId={projectId}
            userId={userId}
            userName={userName}
            userAvatar={userAvatar}
            onNewMessageReceived={onNewMessageReceived}
            onOpenMediaInEditor={onOpenMediaInEditor}
          />
        )}

        {activeTab === 'voice' && (
          <VoicePanel
            isInVoice={isInVoice}
            isMuted={isMuted}
            voicePeers={voicePeers}
            connectionState={voiceConnectionState}
            userName={userName}
            userColor={userColor}
            onJoinVoice={onJoinVoice}
            onLeaveVoice={onLeaveVoice}
            onToggleMute={onToggleMute}
          />
        )}

        {activeTab === 'activity' && (
          <ActivityFeed projectId={projectId} />
        )}

        {activeTab === 'split' && (
          <div className="flex w-full h-full min-h-0 divide-x divide-[#333333]">
            <div className="w-1/2 h-full min-h-0">
              <TerminalPanel 
                projectId={projectId} 
                onPortDetected={handlePortDetected} 
                activeFileName={activeFileName}
              />
            </div>
            <div className="w-1/2 h-full min-h-0">
              <PreviewPanel 
                projectId={projectId} 
                initialPort={detectedPort} 
                availablePorts={availablePorts}
                activeFileName={activeFileName}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

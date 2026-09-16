'use client';

import React, { useState } from 'react';
import { TerminalPanel } from './TerminalPanel';
import { PreviewPanel } from './PreviewPanel';
import { ChatPanel } from './ChatPanel';
import { VoicePanel } from './VoicePanel';
import { ActivityFeed } from './ActivityFeed';
import { GitPanel } from './GitPanel';
import { ProblemsPanel, ProblemItem } from './ProblemsPanel';
import { OutputPanel, OutputLogEntry } from './OutputPanel';
import { 
  Terminal, 
  MonitorPlay, 
  Columns, 
  MessageSquare, 
  Mic, 
  Activity, 
  FolderGit2,
  AlertCircle,
  FileText,
  X, 
  Maximize2, 
  Minimize2,
  PanelBottom,
  PanelRight,
  PanelLeft,
} from 'lucide-react';
import { VoicePeer } from '@/lib/types';

export type DockOrientation = 'bottom' | 'right' | 'left' | 'fullscreen';

export type DockTab = 
  | 'terminal' 
  | 'problems'
  | 'output'
  | 'preview' 
  | 'git' 
  | 'chat' 
  | 'voice' 
  | 'activity' 
  | 'split';

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
  // Level 7: Problems & Output
  problems?: ProblemItem[];
  onNavigateToProblem?: (fileId: string, line: number, col: number) => void;
  outputLogs?: OutputLogEntry[];
  onClearOutputLogs?: () => void;
  activeTab?: DockTab;
  onTabChange?: (tab: DockTab) => void;
  onNavigateToFile?: (filePath: string, line?: number) => void;
  onMoveTabToSidebar?: (tab: 'git' | 'chat' | 'voice') => void;
  theme?: string;
}

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
  problems = [],
  onNavigateToProblem,
  outputLogs = [],
  onClearOutputLogs,
  activeTab: externalActiveTab,
  onTabChange,
  onNavigateToFile,
  onMoveTabToSidebar,
  theme,
}: BottomDockProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<DockTab>('terminal');
  const activeTab = externalActiveTab || internalActiveTab;

  const setActiveTab = (tab: DockTab) => {
    setInternalActiveTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  const [height, setHeight] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`codecollab_dock_height_${userId || 'guest'}`);
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 150 && val <= 1200) return val;
      }
    }
    return 340;
  });

  const [width, setWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`codecollab_dock_width_${userId || 'guest'}`);
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 250 && val <= 1400) return val;
      }
    }
    return 520;
  });

  const [detectedPort, setDetectedPort] = useState<number>(5000);
  const [availablePorts, setAvailablePorts] = useState<number[]>([]);

  if (!isOpen) return null;

  const errorCount = problems.filter(p => p.severity === 'error').length;
  const warningCount = problems.filter(p => p.severity === 'warning').length;

  const handlePortDetected = (port: number) => {
    setDetectedPort(port);
    setAvailablePorts((prev) => Array.from(new Set([...prev, port])));
    if (activeTab === 'terminal') {
      setActiveTab('split');
    }
  };

  const handleTopResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = height;

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      const maxHeight = typeof window !== 'undefined' ? window.innerHeight - 100 : 800;
      const newHeight = Math.max(160, Math.min(maxHeight, startHeight + delta));
      setHeight(newHeight);
    };

    const handleMouseUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      const delta = startY - ev.clientY;
      const maxHeight = typeof window !== 'undefined' ? window.innerHeight - 100 : 800;
      const finalHeight = Math.max(160, Math.min(maxHeight, startHeight + delta));
      setHeight(finalHeight);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`codecollab_dock_height_${userId || 'guest'}`, String(finalHeight));
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleSideResizeStart = (e: React.MouseEvent, isRightDock: boolean) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = isRightDock ? (startX - ev.clientX) : (ev.clientX - startX);
      const maxWidth = typeof window !== 'undefined' ? window.innerWidth - 200 : 1000;
      const newWidth = Math.max(280, Math.min(maxWidth, startWidth + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      const delta = isRightDock ? (startX - ev.clientX) : (ev.clientX - startX);
      const maxWidth = typeof window !== 'undefined' ? window.innerWidth - 200 : 1000;
      const finalWidth = Math.max(280, Math.min(maxWidth, startWidth + delta));
      setWidth(finalWidth);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`codecollab_dock_width_${userId || 'guest'}`, String(finalWidth));
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Determine container styling based on orientation
  let containerClasses = 'flex flex-col z-30 transition-all duration-75 shadow-2xl overflow-hidden relative ';
  let containerStyle: React.CSSProperties = {
    backgroundColor: 'var(--ide-dock)',
  };

  if (orientation === 'bottom') {
    containerClasses += 'border-t w-full';
    containerStyle = { ...containerStyle, height: `${height}px`, borderColor: 'var(--ide-border)' };
  } else if (orientation === 'right') {
    containerClasses += 'border-l h-full flex-shrink-0';
    containerStyle = { ...containerStyle, width: `${width}px`, borderColor: 'var(--ide-border)' };
  } else if (orientation === 'left') {
    containerClasses += 'border-r h-full flex-shrink-0';
    containerStyle = { ...containerStyle, width: `${width}px`, borderColor: 'var(--ide-border)' };
  } else if (orientation === 'fullscreen') {
    containerClasses += 'fixed inset-0 w-full h-full z-50';
  }

  return (
    <div className={containerClasses} style={containerStyle}>
      {/* Top resize handle for bottom orientation */}
      {orientation === 'bottom' && (
        <div
          onMouseDown={handleTopResizeStart}
          className="h-1.5 w-full cursor-row-resize hover:bg-sky-500/50 active:bg-sky-500 transition-colors z-40 select-none flex-shrink-0"
          title="Drag to resize dock height"
        />
      )}

      {/* Left resize handle for right orientation */}
      {orientation === 'right' && (
        <div
          onMouseDown={(e) => handleSideResizeStart(e, true)}
          className="w-1.5 h-full cursor-col-resize hover:bg-sky-500/50 active:bg-sky-500 transition-colors absolute left-0 top-0 z-40 select-none"
          title="Drag to resize dock width"
        />
      )}

      {/* Right resize handle for left orientation */}
      {orientation === 'left' && (
        <div
          onMouseDown={(e) => handleSideResizeStart(e, false)}
          className="w-1.5 h-full cursor-col-resize hover:bg-sky-500/50 active:bg-sky-500 transition-colors absolute right-0 top-0 z-40 select-none"
          title="Drag to resize dock width"
        />
      )}
      {/* Dock Header */}
      <div 
        className="h-9 px-3 border-b flex items-center justify-between select-none flex-shrink-0"
        style={{
          backgroundColor: 'var(--ide-dock-header)',
          borderColor: 'var(--ide-border)',
        }}
      >
        {/* Tab Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {/* Terminal Tab */}
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap hover:bg-black/5 dark:hover:bg-white/5 ${
              activeTab === 'terminal' ? 'border-t-2 font-semibold' : 'opacity-80 hover:opacity-100'
            }`}
            style={{
              backgroundColor: activeTab === 'terminal' ? 'var(--ide-dock)' : undefined,
              color: activeTab === 'terminal' ? 'var(--ide-text)' : 'var(--ide-text-muted)',
              borderTopColor: activeTab === 'terminal' ? 'var(--ide-accent)' : undefined,
            }}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Terminal</span>
          </button>

          {/* Problems Tab (Level 7) */}
          <button
            onClick={() => setActiveTab('problems')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap hover:bg-black/5 dark:hover:bg-white/5 ${
              activeTab === 'problems' ? 'border-t-2 font-semibold' : 'opacity-80 hover:opacity-100'
            }`}
            style={{
              backgroundColor: activeTab === 'problems' ? 'var(--ide-dock)' : undefined,
              color: activeTab === 'problems' ? 'var(--ide-text)' : 'var(--ide-text-muted)',
              borderTopColor: activeTab === 'problems' ? 'var(--ide-accent)' : undefined,
            }}
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Problems</span>
            {(errorCount > 0 || warningCount > 0) && (
              <span className="flex items-center gap-1 text-[10px] font-bold">
                {errorCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-400">{errorCount}</span>
                )}
                {warningCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400">{warningCount}</span>
                )}
              </span>
            )}
          </button>

          {/* Output Tab (Level 7) */}
          <button
            onClick={() => setActiveTab('output')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap hover:bg-black/5 dark:hover:bg-white/5 ${
              activeTab === 'output' ? 'border-t-2 font-semibold' : 'opacity-80 hover:opacity-100'
            }`}
            style={{
              backgroundColor: activeTab === 'output' ? 'var(--ide-dock)' : undefined,
              color: activeTab === 'output' ? 'var(--ide-text)' : 'var(--ide-text-muted)',
              borderTopColor: activeTab === 'output' ? 'var(--ide-accent)' : undefined,
            }}
          >
            <FileText className="w-3.5 h-3.5 text-sky-400" />
            <span>Output</span>
          </button>

          {/* Web Preview Tab */}
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap hover:bg-black/5 dark:hover:bg-white/5 ${
              activeTab === 'preview' ? 'border-t-2 font-semibold' : 'opacity-80 hover:opacity-100'
            }`}
            style={{
              backgroundColor: activeTab === 'preview' ? 'var(--ide-dock)' : undefined,
              color: activeTab === 'preview' ? 'var(--ide-text)' : 'var(--ide-text-muted)',
              borderTopColor: activeTab === 'preview' ? 'var(--ide-accent)' : undefined,
            }}
          >
            <MonitorPlay className="w-3.5 h-3.5 text-sky-400" />
            <span>Preview</span>
            {availablePorts.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          {/* Source Control / Git Tab */}
          <button
            onClick={() => setActiveTab('git')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap hover:bg-black/5 dark:hover:bg-white/5 ${
              activeTab === 'git' ? 'border-t-2 font-semibold' : 'opacity-80 hover:opacity-100'
            }`}
            style={{
              backgroundColor: activeTab === 'git' ? 'var(--ide-dock)' : undefined,
              color: activeTab === 'git' ? 'var(--ide-text)' : 'var(--ide-text-muted)',
              borderTopColor: activeTab === 'git' ? 'var(--ide-accent)' : undefined,
            }}
            title="Git Version Control & Source Control"
          >
            <FolderGit2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Source Control</span>
          </button>

          {/* Split Tab */}
          <button
            onClick={() => setActiveTab('split')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap hover:bg-black/5 dark:hover:bg-white/5 ${
              activeTab === 'split' ? 'border-t-2 font-semibold' : 'opacity-80 hover:opacity-100'
            }`}
            style={{
              backgroundColor: activeTab === 'split' ? 'var(--ide-dock)' : undefined,
              color: activeTab === 'split' ? 'var(--ide-text)' : 'var(--ide-text-muted)',
              borderTopColor: activeTab === 'split' ? 'var(--ide-accent)' : undefined,
            }}
            title="Split view: Terminal and Live Preview side-by-side"
          >
            <Columns className="w-3.5 h-3.5 text-indigo-400" />
            <span>Split</span>
          </button>

          <div 
            className="h-3.5 w-px mx-0.5 flex-shrink-0" 
            style={{ backgroundColor: 'var(--ide-border)' }} 
          />

          {/* Project Chat Tab */}
          <button
            onClick={() => {
              setActiveTab('chat');
              onClearUnread();
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors relative whitespace-nowrap hover:bg-black/5 dark:hover:bg-white/5 ${
              activeTab === 'chat' ? 'border-t-2 font-semibold' : 'opacity-80 hover:opacity-100'
            }`}
            style={{
              backgroundColor: activeTab === 'chat' ? 'var(--ide-dock)' : undefined,
              color: activeTab === 'chat' ? 'var(--ide-text)' : 'var(--ide-text-muted)',
              borderTopColor: activeTab === 'chat' ? 'var(--ide-accent)' : undefined,
            }}
          >
            <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
            <span>Chat</span>
            {unreadCount > 0 && activeTab !== 'chat' && (
              <span className="px-1.5 py-0.2 rounded-full bg-sky-500 text-[10px] font-bold text-white leading-none">
                {unreadCount}
              </span>
            )}
          </button>

          {/* WebRTC Voice Tab */}
          <button
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors relative whitespace-nowrap hover:bg-black/5 dark:hover:bg-white/5 ${
              activeTab === 'voice' ? 'border-t-2 font-semibold' : 'opacity-80 hover:opacity-100'
            }`}
            style={{
              backgroundColor: activeTab === 'voice' ? 'var(--ide-dock)' : undefined,
              color: activeTab === 'voice' ? 'var(--ide-text)' : 'var(--ide-text-muted)',
              borderTopColor: activeTab === 'voice' ? 'var(--ide-accent)' : undefined,
            }}
          >
            <Mic className={`w-3.5 h-3.5 ${isInVoice ? 'text-emerald-400' : 'opacity-60'}`} />
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

          {/* Project Activity Feed Tab */}
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap hover:bg-black/5 dark:hover:bg-white/5 ${
              activeTab === 'activity' ? 'border-t-2 font-semibold' : 'opacity-80 hover:opacity-100'
            }`}
            style={{
              backgroundColor: activeTab === 'activity' ? 'var(--ide-dock)' : undefined,
              color: activeTab === 'activity' ? 'var(--ide-text)' : 'var(--ide-text-muted)',
              borderTopColor: activeTab === 'activity' ? 'var(--ide-accent)' : undefined,
            }}
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>Activity</span>
          </button>
        </div>

        {/* DevTools-Style Dock Orientation Switchers & Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <div 
            className="flex items-center p-0.5 rounded border mr-1"
            style={{
              backgroundColor: 'var(--ide-card-bg)',
              borderColor: 'var(--ide-border)',
              color: 'var(--ide-text-muted)',
            }}
          >
            <button
              onClick={() => onChangeOrientation('bottom')}
              title="Dock to bottom"
              className={`p-1 rounded transition-colors ${
                orientation === 'bottom'
                  ? 'bg-sky-600 text-white'
                  : 'hover:text-sky-400 hover:bg-black/5 dark:hover:bg-white/10'
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
                  : 'hover:text-sky-400 hover:bg-black/5 dark:hover:bg-white/10'
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
                  : 'hover:text-sky-400 hover:bg-black/5 dark:hover:bg-white/10'
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
                  : 'hover:text-sky-400 hover:bg-black/5 dark:hover:bg-white/10'
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
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            style={{ color: 'var(--ide-text-muted)' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Dock Content Body */}
      <div className="flex-1 w-full h-full min-h-0 overflow-hidden flex flex-col relative">
        {activeTab === 'terminal' && (
          <TerminalPanel 
            projectId={projectId} 
            onPortDetected={handlePortDetected} 
            activeFileName={activeFileName}
            theme={theme}
          />
        )}

        {activeTab === 'problems' && (
          <ProblemsPanel
            problems={problems}
            onNavigateToProblem={onNavigateToProblem || (() => {})}
          />
        )}

        {activeTab === 'output' && (
          <OutputPanel
            logs={outputLogs}
            onClearLogs={onClearOutputLogs}
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
            isDockedBottom={true}
            onDockToSidebar={() => onMoveTabToSidebar?.('git')}
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
            onNavigateToFile={onNavigateToFile}
            isSidebarMode={false}
            onDockToSidebar={() => onMoveTabToSidebar?.('chat')}
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
            isSidebarMode={false}
            onDockToSidebar={() => onMoveTabToSidebar?.('voice')}
          />
        )}

        {activeTab === 'activity' && (
          <ActivityFeed projectId={projectId} />
        )}

        {activeTab === 'split' && (
          <div className="flex w-full h-full min-h-0 divide-x" style={{ borderColor: 'var(--ide-border)' }}>
            <div className="w-1/2 h-full min-h-0">
              <TerminalPanel 
                projectId={projectId} 
                onPortDetected={handlePortDetected} 
                activeFileName={activeFileName}
                theme={theme}
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

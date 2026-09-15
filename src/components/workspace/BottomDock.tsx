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
}: BottomDockProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<DockTab>('terminal');
  const activeTab = externalActiveTab || internalActiveTab;

  const setActiveTab = (tab: DockTab) => {
    setInternalActiveTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  const [height, setHeight] = useState<number>(340);
  const [width, setWidth] = useState<number>(480);
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

  // Determine container styling based on orientation
  let containerClasses = 'flex flex-col z-30 transition-all duration-150 shadow-2xl overflow-hidden ';
  let containerStyle: React.CSSProperties = {
    backgroundColor: 'var(--ide-dock)',
  };

  if (orientation === 'bottom') {
    containerClasses += 'border-t w-full';
    containerStyle = { ...containerStyle, height: `${height}px`, borderColor: 'var(--ide-border)' };
  } else if (orientation === 'right') {
    containerClasses += 'border-l h-full';
    containerStyle = { ...containerStyle, width: `${width}px`, borderColor: 'var(--ide-border)' };
  } else if (orientation === 'left') {
    containerClasses += 'border-r h-full';
    containerStyle = { ...containerStyle, width: `${width}px`, borderColor: 'var(--ide-border)' };
  } else if (orientation === 'fullscreen') {
    containerClasses += 'fixed inset-0 w-full h-full z-50';
  }

  return (
    <div className={containerClasses} style={containerStyle}>
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
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'terminal'
                ? 'text-white border-t-2 border-t-sky-500 font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
            style={{
              backgroundColor: activeTab === 'terminal' ? 'var(--ide-dock)' : undefined,
            }}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Terminal</span>
          </button>

          {/* Problems Tab (Level 7) */}
          <button
            onClick={() => setActiveTab('problems')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'problems'
                ? 'text-white border-t-2 border-t-amber-500 font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
            style={{
              backgroundColor: activeTab === 'problems' ? 'var(--ide-dock)' : undefined,
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
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'output'
                ? 'text-white border-t-2 border-t-sky-500 font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
            style={{
              backgroundColor: activeTab === 'output' ? 'var(--ide-dock)' : undefined,
            }}
          >
            <FileText className="w-3.5 h-3.5 text-sky-400" />
            <span>Output</span>
          </button>

          {/* Web Preview Tab */}
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'preview'
                ? 'text-white border-t-2 border-t-sky-500 font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
            style={{
              backgroundColor: activeTab === 'preview' ? 'var(--ide-dock)' : undefined,
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
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'git'
                ? 'text-white border-t-2 border-t-indigo-500 font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
            style={{
              backgroundColor: activeTab === 'git' ? 'var(--ide-dock)' : undefined,
            }}
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
                ? 'text-white border-t-2 border-t-sky-500 font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
            style={{
              backgroundColor: activeTab === 'split' ? 'var(--ide-dock)' : undefined,
            }}
            title="Split view: Terminal and Live Preview side-by-side"
          >
            <Columns className="w-3.5 h-3.5 text-indigo-400" />
            <span>Split</span>
          </button>

          <div className="h-3.5 w-px bg-neutral-700 mx-0.5 flex-shrink-0" />

          {/* Project Chat Tab */}
          <button
            onClick={() => {
              setActiveTab('chat');
              onClearUnread();
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'chat'
                ? 'text-white border-t-2 border-t-sky-400 font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
            style={{
              backgroundColor: activeTab === 'chat' ? 'var(--ide-dock)' : undefined,
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
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'voice'
                ? 'text-white border-t-2 border-t-emerald-500 font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
            style={{
              backgroundColor: activeTab === 'voice' ? 'var(--ide-dock)' : undefined,
            }}
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

          {/* Project Activity Feed Tab */}
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'activity'
                ? 'text-white border-t-2 border-t-amber-400 font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
            }`}
            style={{
              backgroundColor: activeTab === 'activity' ? 'var(--ide-dock)' : undefined,
            }}
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>Activity</span>
          </button>
        </div>

        {/* DevTools-Style Dock Orientation Switchers & Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="flex items-center bg-black/20 p-0.5 rounded border border-white/10 mr-1">
            <button
              onClick={() => onChangeOrientation('bottom')}
              title="Dock to bottom"
              className={`p-1 rounded transition-colors ${
                orientation === 'bottom'
                  ? 'bg-sky-600 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-white/10'
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
                  : 'text-neutral-400 hover:text-white hover:bg-white/10'
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
                  : 'text-neutral-400 hover:text-white hover:bg-white/10'
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
                  : 'text-neutral-400 hover:text-white hover:bg-white/10'
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
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
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
          <div className="flex w-full h-full min-h-0 divide-x" style={{ borderColor: 'var(--ide-border)' }}>
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

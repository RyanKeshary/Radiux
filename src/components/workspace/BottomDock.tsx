'use client';

import React, { useState } from 'react';
import { TerminalPanel } from './TerminalPanel';
import { PreviewPanel } from './PreviewPanel';
import { 
  Terminal, 
  MonitorPlay, 
  Columns, 
  X, 
  Maximize2, 
  Minimize2 
} from 'lucide-react';

interface BottomDockProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  activeFileName?: string | null;
}

type DockTab = 'terminal' | 'preview' | 'split';

export function BottomDock({ projectId, isOpen, onClose, activeFileName }: BottomDockProps) {
  const [activeTab, setActiveTab] = useState<DockTab>('terminal');
  const [height, setHeight] = useState<number>(300);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
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

  const currentHeight = isMaximized ? 'calc(100vh - 40px)' : `${height}px`;

  return (
    <div
      style={{ height: currentHeight }}
      className="border-t border-[#3c3c3c] bg-[#181818] flex flex-col z-30 transition-all duration-150 shadow-2xl"
    >
      {/* Dock Header */}
      <div className="h-8 bg-[#252526] border-b border-[#333333] px-3 flex items-center justify-between select-none">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === 'terminal'
                ? 'bg-[#181818] text-white border-t-2 border-t-sky-500'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-sky-400" />
            <span>Terminal</span>
          </button>

          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === 'preview'
                ? 'bg-[#181818] text-white border-t-2 border-t-emerald-500'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <MonitorPlay className="w-3.5 h-3.5 text-emerald-400" />
            <span>Web Preview</span>
            {availablePorts.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('split')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === 'split'
                ? 'bg-[#181818] text-white border-t-2 border-t-indigo-500'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
            title="Split view: Terminal and Live Preview side-by-side"
          >
            <Columns className="w-3.5 h-3.5 text-indigo-400" />
            <span>Split View</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? "Restore Size" : "Maximize Panel"}
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-[#333333] transition-colors"
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onClose}
            title="Close Panel"
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-[#333333] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Dock Content Body */}
      <div className="flex-1 w-full h-full overflow-hidden flex">
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

        {activeTab === 'split' && (
          <div className="flex w-full h-full divide-x divide-[#333333]">
            <div className="w-1/2 h-full">
              <TerminalPanel 
                projectId={projectId} 
                onPortDetected={handlePortDetected} 
                activeFileName={activeFileName}
              />
            </div>
            <div className="w-1/2 h-full">
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

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Copy, Check, Terminal, ArrowDown } from 'lucide-react';

export interface OutputLogEntry {
  id: string;
  channel: 'system' | 'sync' | 'git' | 'runtime';
  message: string;
  timestamp: string;
}

interface OutputPanelProps {
  logs: OutputLogEntry[];
  onClearLogs?: () => void;
}

export function OutputPanel({ logs, onClearLogs }: OutputPanelProps) {
  const [selectedChannel, setSelectedChannel] = useState<'all' | 'system' | 'sync' | 'git' | 'runtime'>('all');
  const [copied, setCopied] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const filteredLogs = logs.filter(
    (l) => selectedChannel === 'all' || l.channel === selectedChannel
  );

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredLogs.length]);

  const handleCopy = () => {
    const text = filteredLogs.map((l) => `[${l.timestamp}] [${l.channel.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="flex flex-col w-full h-full text-xs select-none font-mono"
      style={{
        backgroundColor: 'var(--ide-dock)',
        color: 'var(--ide-text)',
      }}
    >
      {/* Output Toolbar */}
      <div 
        className="h-8 px-3 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: 'var(--ide-border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="font-sans" style={{ color: 'var(--ide-text-muted)' }}>Channel:</span>
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value as any)}
            className="border rounded px-2 py-0.5 text-xs focus:outline-none focus:border-sky-500"
            style={{
              backgroundColor: 'var(--ide-input-bg)',
              borderColor: 'var(--ide-border)',
              color: 'var(--ide-text)',
            }}
          >
            <option value="all">All Channels</option>
            <option value="system">Radiux System</option>
            <option value="sync">Workspace Sync</option>
            <option value="git">Git Operations</option>
            <option value="runtime">Server Runtime</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-white/10 transition-colors flex items-center gap-1"
            style={{ color: 'var(--ide-text-muted)' }}
            title="Copy Output"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="text-[11px]">Copy</span>
          </button>

          {onClearLogs && (
            <button
              onClick={onClearLogs}
              className="p-1 rounded hover:bg-white/10 transition-colors flex items-center gap-1"
              style={{ color: 'var(--ide-text-muted)' }}
              title="Clear Output"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="text-[11px]">Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Log Stream */}
      <div 
        className="flex-1 overflow-y-auto p-3 space-y-1 font-mono text-[11px] leading-relaxed select-text"
        style={{ color: 'var(--ide-text)' }}
      >
        {filteredLogs.length === 0 ? (
          <div className="italic py-4" style={{ color: 'var(--ide-text-muted)' }}>No output in this channel.</div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 hover:bg-white/[0.02] px-1 py-0.5 rounded">
              <span className="select-none flex-shrink-0" style={{ color: 'var(--ide-text-muted)' }}>[{log.timestamp}]</span>
              <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold select-none flex-shrink-0 ${
                log.channel === 'system' ? 'bg-sky-500/20 text-sky-400' :
                log.channel === 'git' ? 'bg-indigo-500/20 text-indigo-400' :
                log.channel === 'runtime' ? 'bg-emerald-500/20 text-emerald-400' :
                'bg-amber-500/20 text-amber-400'
              }`}>
                {log.channel}
              </span>
              <span className="break-words flex-1">{log.message}</span>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

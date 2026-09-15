'use client';

import React, { useState, useMemo } from 'react';
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  ChevronRight, 
  ChevronDown, 
  Search,
  Filter
} from 'lucide-react';
import { FileIcon } from './FileIcon';

export interface ProblemItem {
  id: string;
  fileId: string;
  fileName: string;
  filePath: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  startLineNumber: number;
  startColumn: number;
  source?: string;
}

interface ProblemsPanelProps {
  problems: ProblemItem[];
  onNavigateToProblem: (fileId: string, line: number, col: number) => void;
}

export function ProblemsPanel({ problems, onNavigateToProblem }: ProblemsPanelProps) {
  const [filterText, setFilterText] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'error' | 'warning'>('all');
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});

  const errorCount = useMemo(() => problems.filter(p => p.severity === 'error').length, [problems]);
  const warningCount = useMemo(() => problems.filter(p => p.severity === 'warning').length, [problems]);
  const infoCount = useMemo(() => problems.filter(p => p.severity === 'info').length, [problems]);

  const filteredProblems = useMemo(() => {
    return problems.filter((p) => {
      if (severityFilter !== 'all' && p.severity !== severityFilter) return false;
      if (!filterText.trim()) return true;
      const query = filterText.toLowerCase();
      return (
        p.message.toLowerCase().includes(query) ||
        p.fileName.toLowerCase().includes(query) ||
        p.filePath.toLowerCase().includes(query)
      );
    });
  }, [problems, filterText, severityFilter]);

  // Group problems by file
  const groupedProblems = useMemo(() => {
    const groups: Record<string, { fileName: string; filePath: string; fileId: string; items: ProblemItem[] }> = {};
    for (const item of filteredProblems) {
      if (!groups[item.filePath]) {
        groups[item.filePath] = {
          fileName: item.fileName,
          filePath: item.filePath,
          fileId: item.fileId,
          items: [],
        };
      }
      groups[item.filePath].items.push(item);
    }
    return Object.values(groups);
  }, [filteredProblems]);

  const toggleFileCollapse = (filePath: string) => {
    setCollapsedFiles(prev => ({ ...prev, [filePath]: !prev[filePath] }));
  };

  return (
    <div 
      className="flex flex-col w-full h-full text-xs select-none"
      style={{
        backgroundColor: 'var(--ide-dock)',
        color: 'var(--ide-text)',
      }}
    >
      {/* Filter and Summary Toolbar */}
      <div 
        className="h-8 px-3 border-b flex items-center justify-between gap-3 select-none flex-shrink-0"
        style={{ borderColor: 'var(--ide-border)' }}
      >
        <div className="flex items-center gap-3">
          {/* Error / Warning Counters */}
          <button
            onClick={() => setSeverityFilter(prev => prev === 'error' ? 'all' : 'error')}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors ${
              severityFilter === 'error' ? 'bg-red-500/20 text-red-400 font-semibold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
            <span>{errorCount} Errors</span>
          </button>

          <button
            onClick={() => setSeverityFilter(prev => prev === 'warning' ? 'all' : 'warning')}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors ${
              severityFilter === 'warning' ? 'bg-amber-500/20 text-amber-400 font-semibold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>{warningCount} Warnings</span>
          </button>

          {infoCount > 0 && (
            <span className="flex items-center gap-1.5 text-sky-400 px-1">
              <Info className="w-3.5 h-3.5" />
              <span>{infoCount} Info</span>
            </span>
          )}
        </div>

        {/* Filter Input */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2 pointer-events-none" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter problems (text, file)..."
            className="w-48 pl-7 pr-2 py-0.5 rounded bg-black/30 border border-neutral-700 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-sky-500 font-mono"
          />
        </div>
      </div>

      {/* Problems List Body */}
      <div className="flex-1 overflow-y-auto font-mono text-[11.5px] p-2 space-y-1">
        {groupedProblems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-2 py-8 select-none">
            <CheckCircle2 className="w-8 h-8 text-emerald-500/70" />
            <p className="text-xs text-neutral-400 font-medium">No problems have been detected in the workspace.</p>
            <p className="text-[11px] text-neutral-500">Syntax errors and language diagnostics will appear here automatically.</p>
          </div>
        ) : (
          groupedProblems.map((group) => {
            const isCollapsed = collapsedFiles[group.filePath];
            const groupErrors = group.items.filter(i => i.severity === 'error').length;
            const groupWarnings = group.items.filter(i => i.severity === 'warning').length;

            return (
              <div key={group.filePath} className="border border-white/5 rounded overflow-hidden">
                {/* File Header */}
                <div
                  onClick={() => toggleFileCollapse(group.filePath)}
                  className="flex items-center justify-between px-2.5 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
                    )}
                    <FileIcon name={group.fileName} isFolder={false} className="w-3.5 h-3.5" />
                    <span className="font-semibold text-neutral-200">{group.fileName}</span>
                    <span className="text-[10px] text-neutral-500 font-normal">{group.filePath}</span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px]">
                    {groupErrors > 0 && (
                      <span className="text-red-400 font-bold bg-red-500/10 px-1.5 py-0.2 rounded">
                        {groupErrors}
                      </span>
                    )}
                    {groupWarnings > 0 && (
                      <span className="text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.2 rounded">
                        {groupWarnings}
                      </span>
                    )}
                  </div>
                </div>

                {/* Problem Items in File */}
                {!isCollapsed && (
                  <div className="divide-y divide-white/[0.03]">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => onNavigateToProblem(item.fileId, item.startLineNumber, item.startColumn)}
                        className="flex items-start gap-2.5 px-3 py-1.5 hover:bg-sky-600/15 cursor-pointer transition-colors group"
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {item.severity === 'error' && (
                            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                          )}
                          {item.severity === 'warning' && (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          )}
                          {item.severity === 'info' && (
                            <Info className="w-3.5 h-3.5 text-sky-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-neutral-300 group-hover:text-white leading-relaxed break-words">
                            {item.message}
                          </p>
                          {item.source && (
                            <span className="text-[10px] text-neutral-500">[{item.source}]</span>
                          )}
                        </div>

                        <div className="text-neutral-500 group-hover:text-neutral-300 text-[11px] flex-shrink-0 tabular-nums">
                          Ln {item.startLineNumber}, Col {item.startColumn}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

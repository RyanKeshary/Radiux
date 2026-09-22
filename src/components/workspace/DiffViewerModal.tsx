'use client';

import React from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { DiffProposal } from '@/lib/ai/types';
import { Check, X, FileCode2, GitBranch } from 'lucide-react';

export interface DiffViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Git diff mode props
  filePath?: string;
  diff?: string;
  isStaged?: boolean;
  // AI diff mode props
  proposal?: DiffProposal | null;
  onAccept?: (proposal: DiffProposal) => void;
  onReject?: (proposal: DiffProposal) => void;
}

export function DiffViewerModal({
  isOpen,
  onClose,
  filePath,
  diff,
  isStaged,
  proposal,
  onAccept,
  onReject,
}: DiffViewerModalProps) {
  if (!isOpen) return null;

  const isAIMode = !!proposal;
  const displayPath = proposal ? proposal.path : filePath || 'file';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div 
        className="w-full max-w-5xl h-[85vh] flex flex-col rounded-xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{ backgroundColor: 'var(--ide-bg, #1e1e1e)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-neutral-900/60">
          <div className="flex items-center gap-2">
            {isAIMode ? (
              <FileCode2 className="w-4 h-4 text-sky-400" />
            ) : (
              <GitBranch className="w-4 h-4 text-emerald-400" />
            )}
            <span className="text-xs font-semibold text-neutral-200">
              {isAIMode ? 'AI Proposed Diff:' : (isStaged ? 'Staged Git Changes:' : 'Unstaged Git Changes:')}{' '}
              <span className="font-mono text-sky-300">{displayPath}</span>
            </span>
            {proposal?.summary && (
              <span className="text-[11px] text-neutral-400 font-normal">
                ({proposal.summary})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isAIMode && proposal && onAccept && (
              <button
                onClick={() => {
                  onAccept(proposal);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Accept Changes</span>
              </button>
            )}
            {isAIMode && proposal && onReject && (
              <button
                onClick={() => {
                  onReject(proposal);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-600/80 hover:bg-red-500 text-white text-xs font-medium shadow-sm transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-white/5 transition-colors ml-2"
              title="Close Diff Preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Diff Content Area */}
        {isAIMode && proposal ? (
          <>
            <div className="flex items-center justify-between px-4 py-1.5 bg-neutral-950/40 text-[11px] text-neutral-400 border-b border-white/5 font-mono">
              <span>Original (Current file)</span>
              <span>Proposed (AI Agent modifications)</span>
            </div>
            <div className="flex-1 w-full overflow-hidden">
              <DiffEditor
                original={proposal.originalContent}
                modified={proposal.proposedContent}
                language={proposal.path.endsWith('.tsx') || proposal.path.endsWith('.ts') ? 'typescript' : 'javascript'}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  renderSideBySide: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 12,
                  lineNumbers: 'on',
                  folding: true,
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 w-full overflow-auto p-4 font-mono text-xs text-neutral-200 bg-neutral-950 whitespace-pre leading-relaxed">
            {diff ? (
              diff.split('\n').map((line, idx) => {
                const isAdd = line.startsWith('+') && !line.startsWith('+++');
                const isDel = line.startsWith('-') && !line.startsWith('---');
                const isHunk = line.startsWith('@@');

                let color = 'text-neutral-300';
                let bg = 'transparent';
                if (isAdd) {
                  color = 'text-emerald-400';
                  bg = 'rgba(16, 185, 129, 0.1)';
                } else if (isDel) {
                  color = 'text-red-400';
                  bg = 'rgba(239, 68, 68, 0.1)';
                } else if (isHunk) {
                  color = 'text-sky-400 font-semibold';
                  bg = 'rgba(56, 189, 248, 0.05)';
                }

                return (
                  <div key={idx} style={{ backgroundColor: bg }} className={`px-2 py-0.5 ${color}`}>
                    {line || ' '}
                  </div>
                );
              })
            ) : (
              <span className="text-neutral-500">No diff changes to display.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

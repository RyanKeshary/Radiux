'use client';

import React, { useState, useMemo } from 'react';
import { X, FileText, Plus, Minus, Check, Copy } from 'lucide-react';

interface DiffViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  diff: string;
  isStaged?: boolean;
}

export function DiffViewerModal({
  isOpen,
  onClose,
  filePath,
  diff,
  isStaged = false,
}: DiffViewerModalProps) {
  const [copied, setCopied] = useState(false);

  // Parse git unified diff into structured lines with line numbers
  const parsedDiff = useMemo(() => {
    if (!diff) return [];
    const rawLines = diff.split('\n');
    let oldLine = 0;
    let newLine = 0;
    const lines = [];

    for (const raw of rawLines) {
      if (raw.startsWith('@@')) {
        // Parse hunk header: @@ -oldStart,oldLen +newStart,newLen @@
        const match = raw.match(/@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
        if (match) {
          oldLine = parseInt(match[1], 10) - 1;
          newLine = parseInt(match[2], 10) - 1;
        }
        lines.push({ type: 'header', text: raw, oldNum: null, newNum: null });
      } else if (raw.startsWith('+') && !raw.startsWith('+++')) {
        newLine++;
        lines.push({ type: 'add', text: raw.substring(1), oldNum: null, newNum: newLine });
      } else if (raw.startsWith('-') && !raw.startsWith('---')) {
        oldLine++;
        lines.push({ type: 'del', text: raw.substring(1), oldNum: oldLine, newNum: null });
      } else if (raw.startsWith('diff --git') || raw.startsWith('index ') || raw.startsWith('---') || raw.startsWith('+++')) {
        // Metadata header
        lines.push({ type: 'meta', text: raw, oldNum: null, newNum: null });
      } else {
        // Context line
        oldLine++;
        newLine++;
        lines.push({ type: 'context', text: raw.startsWith(' ') ? raw.substring(1) : raw, oldNum: oldLine, newNum: newLine });
      }
    }
    return lines;
  }, [diff]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(diff);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        style={{
          backgroundColor: 'var(--ide-bg)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
        className="border rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: 'var(--ide-dock-header)',
            borderColor: 'var(--ide-border)',
          }}
          className="px-5 py-3.5 border-b flex items-center justify-between"
        >
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-sky-400" />
            <span className="font-semibold text-sm" style={{ color: 'var(--ide-text)' }}>{filePath || 'Changes Diff'}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
              isStaged ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              {isStaged ? 'STAGED' : 'WORKING TREE'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              style={{
                backgroundColor: 'var(--ide-input-bg)',
                borderColor: 'var(--ide-border)',
                color: 'var(--ide-text)',
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border transition-colors hover:opacity-90"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Diff'}</span>
            </button>
            <button
              onClick={onClose}
              style={{ color: 'var(--ide-text-muted)' }}
              className="p-1 rounded hover:opacity-80 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Diff content view */}
        <div
          style={{
            backgroundColor: 'var(--ide-bg)',
            color: 'var(--ide-text)',
          }}
          className="flex-1 overflow-auto font-mono text-xs p-2 select-text"
        >
          {parsedDiff.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--ide-text-muted)' }}>
              No differences detected for this file.
            </div>
          ) : (
            <table className="w-full border-collapse">
              <tbody>
                {parsedDiff.map((line, idx) => {
                  if (line.type === 'meta') {
                    return (
                      <tr key={idx} style={{ color: 'var(--ide-text-muted)' }} className="opacity-75">
                        <td className="w-10 px-2 py-0.5 text-right select-none opacity-50">...</td>
                        <td className="w-10 px-2 py-0.5 text-right select-none opacity-50">...</td>
                        <td className="px-3 py-0.5 font-semibold">{line.text}</td>
                      </tr>
                    );
                  }
                  if (line.type === 'header') {
                    return (
                      <tr key={idx} className="bg-sky-950/40 text-sky-400 border-y border-sky-900/40">
                        <td className="w-10 px-2 py-1 text-right select-none text-sky-600">@@</td>
                        <td className="w-10 px-2 py-1 text-right select-none text-sky-600">@@</td>
                        <td className="px-3 py-1 font-bold">{line.text}</td>
                      </tr>
                    );
                  }
                  if (line.type === 'add') {
                    return (
                      <tr key={idx} className="bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/30">
                        <td className="w-10 px-2 py-0.5 text-right select-none opacity-40"></td>
                        <td className="w-10 px-2 py-0.5 text-right select-none text-emerald-500 font-mono">{line.newNum}</td>
                        <td className="px-3 py-0.5 whitespace-pre">
                          <span className="inline-block text-emerald-400 mr-2 select-none">+</span>
                          {line.text}
                        </td>
                      </tr>
                    );
                  }
                  if (line.type === 'del') {
                    return (
                      <tr key={idx} className="bg-red-950/40 text-red-300 hover:bg-red-900/30">
                        <td className="w-10 px-2 py-0.5 text-right select-none text-red-500 font-mono">{line.oldNum}</td>
                        <td className="w-10 px-2 py-0.5 text-right select-none opacity-40"></td>
                        <td className="px-3 py-0.5 whitespace-pre">
                          <span className="inline-block text-red-400 mr-2 select-none">-</span>
                          {line.text}
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={idx} className="hover:opacity-80" style={{ color: 'var(--ide-text)' }}>
                      <td className="w-10 px-2 py-0.5 text-right select-none opacity-40 font-mono">{line.oldNum}</td>
                      <td className="w-10 px-2 py-0.5 text-right select-none opacity-40 font-mono">{line.newNum}</td>
                      <td className="px-3 py-0.5 whitespace-pre">
                        <span className="inline-block text-transparent mr-2 select-none">&nbsp;</span>
                        {line.text}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            backgroundColor: 'var(--ide-dock-header)',
            borderColor: 'var(--ide-border)',
            color: 'var(--ide-text-muted)',
          }}
          className="px-5 py-2.5 border-t flex items-center justify-between text-xs"
        >
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500/80 inline-block"></span> Added
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-red-500/80 inline-block"></span> Removed
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'var(--ide-input-bg)',
              borderColor: 'var(--ide-border)',
              color: 'var(--ide-text)',
            }}
            className="px-3 py-1 rounded border text-xs transition-colors hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

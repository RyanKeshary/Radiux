'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, ArrowRight, Check, X, Loader2 } from 'lucide-react';

interface InlineAIPromptProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText: string;
  filePath: string;
  language: string;
  onAccept: (replacement: string) => void;
}

export function InlineAIPrompt({
  isOpen,
  onClose,
  selectedText,
  filePath,
  language,
  onAccept,
}: InlineAIPromptProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamedResult, setStreamedResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPrompt('');
      setStreamedResult('');
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (customPrompt?: string) => {
    const textToSubmit = customPrompt || prompt;
    if (!textToSubmit.trim() || isGenerating) return;

    setIsGenerating(true);
    setStreamedResult('');
    setError(null);

    try {
      const res = await fetch('/api/ai/inline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath,
          language,
          selectedCode: selectedText,
          userInstruction: textToSubmit,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errData.error || 'Failed to generate inline transformation');
      }

      if (!res.body) throw new Error('No response stream available');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setStreamedResult(accumulated);
      }
    } catch (err: any) {
      setError(err.message || 'Inline transformation error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (streamedResult && !isGenerating) {
        onAccept(streamedResult);
        onClose();
      } else {
        handleSubmit();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl p-2 animate-in fade-in zoom-in-95 duration-100">
      <div 
        className="rounded-xl border border-sky-500/30 bg-neutral-900/95 backdrop-blur-md shadow-2xl p-3 text-neutral-200"
        style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(56, 189, 248, 0.2)' }}
      >
        {/* Header / Input Row */}
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-sky-500/10 text-sky-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedText.trim()
                ? "Edit selection with AI (e.g. 'Optimize this loop', 'Add TypeScript types')..."
                : "Ask AI or generate code here..."
            }
            className="flex-1 bg-transparent text-xs text-white placeholder-neutral-500 outline-none"
            disabled={isGenerating}
          />
          {isGenerating ? (
            <div className="flex items-center gap-1.5 text-xs text-sky-400 px-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Generating...</span>
            </div>
          ) : (
            <button
              onClick={() => handleSubmit()}
              disabled={!prompt.trim()}
              className="p-1.5 rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white transition-colors"
              title="Submit (Enter)"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Cancel (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        {!streamedResult && !isGenerating && (
          <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-white/5 overflow-x-auto text-[11px]">
            <span className="text-neutral-500 font-medium text-[10px] uppercase tracking-wider">Quick:</span>
            {['Optimize performance', 'Add TypeScript types', 'Add error handling', 'Document with JSDoc'].map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  setPrompt(tag);
                  handleSubmit(tag);
                }}
                className="px-2 py-0.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-neutral-200 border border-white/[0.06] transition-colors whitespace-nowrap"
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mt-2.5 p-2 rounded bg-red-950/40 border border-red-500/30 text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Streamed Result Preview */}
        {streamedResult && (
          <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <span className="font-semibold text-sky-400 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-400" />
                Proposed Replacement Preview:
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onAccept(streamedResult);
                    onClose();
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] transition-colors"
                >
                  <Check className="w-3 h-3" />
                  <span>Accept (Enter)</span>
                </button>
                <button
                  onClick={onClose}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] transition-colors"
                >
                  <X className="w-3 h-3" />
                  <span>Reject (Esc)</span>
                </button>
              </div>
            </div>
            <pre className="max-h-48 overflow-y-auto p-2.5 rounded bg-black/50 border border-white/5 font-mono text-[11px] text-emerald-300 whitespace-pre leading-relaxed">
              {streamedResult}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

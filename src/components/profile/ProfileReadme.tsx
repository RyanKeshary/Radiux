'use client';

import React, { useState } from 'react';
import { BookOpen, Edit3, Eye, Check, Loader2, Code, Heading1, Heading2, List, Link as LinkIcon, Bold, Italic } from 'lucide-react';

interface ProfileReadmeProps {
  initialMarkdown: string;
  isOwner: boolean;
  username: string;
  onSave?: (newMarkdown: string) => Promise<void>;
}

export function ProfileReadme({
  initialMarkdown,
  isOwner,
  username,
  onSave,
}: ProfileReadmeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(initialMarkdown || defaultReadmeTemplate(username));
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(content);
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const insertSnippet = (snippet: string) => {
    setContent((prev) => prev + snippet);
  };

  return (
    <div 
      className="rounded-xl border shadow-sm overflow-hidden"
      style={{
        backgroundColor: 'var(--ide-card-bg)',
        borderColor: 'var(--ide-border)',
        color: 'var(--ide-text)',
      }}
    >
      {/* Header bar */}
      <div 
        className="px-5 py-3 border-b flex items-center justify-between"
        style={{
          borderColor: 'var(--ide-border)',
          backgroundColor: 'var(--ide-dock-header)',
        }}
      >
        <div className="flex items-center gap-2 font-semibold text-xs">
          <BookOpen className="w-4 h-4 text-sky-400" />
          <span>{username} / README.md</span>
        </div>

        {isOwner && (
          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium animate-in fade-in">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            {isEditing ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-2.5 py-1 text-xs font-medium rounded border hover:bg-white/5 transition-colors"
                  style={{ borderColor: 'var(--ide-border)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white rounded transition-colors shadow-sm"
                  style={{ backgroundColor: 'var(--ide-accent)' }}
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save README</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border hover:opacity-85 transition-opacity"
                style={{
                  borderColor: 'var(--ide-border)',
                  backgroundColor: 'var(--ide-card-bg)',
                  color: 'var(--ide-text)',
                }}
              >
                <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                <span>Edit README</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Body: Editor or Formatted Preview */}
      {isEditing ? (
        <div className="p-4 space-y-3">
          {/* Quick format helper toolbar */}
          <div className="flex items-center gap-1 p-1 rounded-lg border text-xs" style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-dock-header)' }}>
            <button 
              type="button" 
              onClick={() => insertSnippet('\n# Heading 1\n')} 
              className="p-1.5 rounded hover:bg-white/10" 
              title="Heading 1"
            >
              <Heading1 className="w-3.5 h-3.5" />
            </button>
            <button 
              type="button" 
              onClick={() => insertSnippet('\n## Heading 2\n')} 
              className="p-1.5 rounded hover:bg-white/10" 
              title="Heading 2"
            >
              <Heading2 className="w-3.5 h-3.5" />
            </button>
            <div className="w-[1px] h-4 bg-white/10 mx-1" />
            <button 
              type="button" 
              onClick={() => insertSnippet('**bold text**')} 
              className="p-1.5 rounded hover:bg-white/10" 
              title="Bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button 
              type="button" 
              onClick={() => insertSnippet('*italic text*')} 
              className="p-1.5 rounded hover:bg-white/10" 
              title="Italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button 
              type="button" 
              onClick={() => insertSnippet('\n```typescript\n// your code here\n```\n')} 
              className="p-1.5 rounded hover:bg-white/10" 
              title="Code Block"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
            <button 
              type="button" 
              onClick={() => insertSnippet('\n- Item 1\n- Item 2\n')} 
              className="p-1.5 rounded hover:bg-white/10" 
              title="List"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button 
              type="button" 
              onClick={() => insertSnippet('[Link Title](https://example.com)')} 
              className="p-1.5 rounded hover:bg-white/10" 
              title="Link"
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            className="w-full p-3 font-mono text-xs rounded-lg border outline-none resize-y focus:ring-1 focus:ring-sky-500"
            style={{
              backgroundColor: 'var(--ide-input-bg)',
              borderColor: 'var(--ide-border)',
              color: 'var(--ide-text)',
            }}
            placeholder="Write your developer profile README in Markdown..."
          />
        </div>
      ) : (
        <div className="p-6 prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed space-y-3">
          {renderMarkdownContent(content)}
        </div>
      )}
    </div>
  );
}

function defaultReadmeTemplate(username: string): string {
  return `# Hey, I'm ${username} 👋\n\nI build collaborative software and modern developer tooling.\n\n## 🛠️ What I'm working on\n- Cloud workspace performance & real-time synchronization\n- Frontend design architectures\n\n## 🚀 Technologies & Languages\n\`TypeScript\` · \`React\` · \`Node.js\` · \`Python\`\n\nFeel free to send a **Coding Partner** request or collaborate with me on projects!`;
}

// Lightweight Markdown Renderer (no heavy external dependencies required)
function renderMarkdownContent(markdown: string) {
  if (!markdown || !markdown.trim()) {
    return (
      <p className="text-neutral-500 italic">No README written yet.</p>
    );
  }

  const lines = markdown.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  lines.forEach((line, index) => {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre 
            key={`code-${index}`} 
            className="p-3 rounded-lg border font-mono text-[11.5px] overflow-x-auto my-2"
            style={{
              backgroundColor: 'var(--ide-dock-header)',
              borderColor: 'var(--ide-border)',
              color: 'var(--ide-text)',
            }}
          >
            <code>{codeBuffer.join('\n')}</code>
          </pre>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={index} className="text-lg font-bold pb-1 border-b my-3" style={{ borderColor: 'var(--ide-border)', color: 'var(--ide-text)' }}>
          {line.replace('# ', '')}
        </h1>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={index} className="text-sm font-semibold pb-1 border-b my-2" style={{ borderColor: 'var(--ide-border)', color: 'var(--ide-text)' }}>
          {line.replace('## ', '')}
        </h2>
      );
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={index} className="text-xs font-semibold my-2" style={{ color: 'var(--ide-text)' }}>
          {line.replace('### ', '')}
        </h3>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <li key={index} className="ml-4 list-disc text-[12px] my-0.5" style={{ color: 'var(--ide-text)' }}>
          {formatInline(line.slice(2))}
        </li>
      );
    } else if (line.trim().length === 0) {
      elements.push(<div key={index} className="h-1" />);
    } else {
      elements.push(
        <p key={index} className="text-[12px] my-1" style={{ color: 'var(--ide-text)' }}>
          {formatInline(line)}
        </p>
      );
    }
  });

  return <div className="space-y-1">{elements}</div>;
}

function formatInline(text: string): React.ReactNode {
  // Replace inline backticks with code tag
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code 
          key={i} 
          className="px-1.5 py-0.5 rounded text-[11px] font-mono border"
          style={{
            backgroundColor: 'var(--ide-dock-header)',
            borderColor: 'var(--ide-border)',
            color: 'var(--ide-accent)',
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    // Bold parsing
    if (part.includes('**')) {
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bp, bi) => {
        if (bp.startsWith('**') && bp.endsWith('**')) {
          return <strong key={bi} className="font-semibold">{bp.slice(2, -2)}</strong>;
        }
        return bp;
      });
    }
    return part;
  });
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { config } from '@/lib/config';
import { 
  Send, 
  MessageSquare, 
  Loader2, 
  Image as ImageIcon, 
  Paperclip, 
  X, 
  FileText, 
  Download, 
  Film, 
  Music,
  Maximize2,
  Layers,
  Eye,
  Copy,
  FileCode
} from 'lucide-react';
import { MediaPreviewModal, MediaPreviewItem } from './MediaPreviewModal';

interface ChatPanelProps {
  projectId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  onNewMessageReceived?: () => void;
  onOpenMediaInEditor?: (media: { name: string; url: string; type: 'image' | 'video' | 'audio' | 'file' }) => void;
  onNavigateToFile?: (filePath: string, line?: number) => void;
}

interface PendingMedia {
  file: File;
  previewUrl: string;
  base64: string;
  type: 'image' | 'video' | 'audio' | 'file';
  name: string;
  size: string;
}

function renderMentions(text: string) {
  const mentionRegex = /(@[a-zA-Z0-9_-]+)/g;
  const parts = text.split(mentionRegex);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span key={i} className="text-sky-400 font-semibold px-1 py-0.2 rounded bg-sky-500/10">
          {part}
        </span>
      );
    }
    return part;
  });
}

function renderInlineLinks(text: string, onNavigateToFile?: (path: string, line?: number) => void) {
  const fileRegex = /(\[file:\s*([^\]]+)\])|(([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]{1,4})(?::(\d+))?)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fileRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(renderMentions(text.slice(lastIndex, match.index)));
    }

    let filePath = '';
    let lineNum: number | undefined;

    if (match[1]) {
      const raw = match[2].trim();
      const colIdx = raw.lastIndexOf(':');
      if (colIdx !== -1 && !isNaN(Number(raw.slice(colIdx + 1)))) {
        filePath = raw.slice(0, colIdx);
        lineNum = parseInt(raw.slice(colIdx + 1), 10);
      } else {
        filePath = raw;
      }
    } else if (match[3]) {
      filePath = match[4];
      if (match[5]) {
        lineNum = parseInt(match[5], 10);
      }
    }

    parts.push(
      <button
        key={match.index}
        type="button"
        onClick={() => onNavigateToFile && onNavigateToFile(filePath, lineNum)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 my-0.5 rounded bg-sky-500/20 hover:bg-sky-500/35 text-sky-300 border border-sky-500/30 text-[11px] font-mono transition-colors align-middle"
        title={`Open ${filePath}${lineNum ? ` at line ${lineNum}` : ''}`}
      >
        <FileCode className="w-3 h-3 text-sky-400 flex-shrink-0" />
        <span>{filePath}{lineNum ? `:${lineNum}` : ''}</span>
      </button>
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(renderMentions(text.slice(lastIndex)));
  }

  return parts;
}

function DeveloperMessageText({
  content,
  onNavigateToFile,
}: {
  content: string;
  onNavigateToFile?: (filePath: string, line?: number) => void;
}) {
  if (content.includes('```')) {
    const parts = content.split(/(```[\s\S]*?```)/g);
    return (
      <div className="space-y-1">
        {parts.map((part, idx) => {
          if (part.startsWith('```') && part.endsWith('```')) {
            const lines = part.slice(3, -3).trim().split('\n');
            let lang = '';
            let code = part.slice(3, -3).trim();
            if (lines.length > 1 && !lines[0].includes(' ') && lines[0].length < 15) {
              lang = lines[0];
              code = lines.slice(1).join('\n');
            }
            return (
              <div key={idx} className="my-1 rounded bg-black/40 border border-white/10 p-2 font-mono text-[11px] relative group select-text">
                <div className="flex items-center justify-between pb-1 mb-1 border-b border-white/5 text-[9px] text-neutral-500 uppercase">
                  <span>{lang || 'code'}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(code)}
                    className="hover:text-white flex items-center gap-0.5 text-[10px]"
                  >
                    <Copy className="w-2.5 h-2.5" />
                    <span>Copy</span>
                  </button>
                </div>
                <pre className="overflow-x-auto whitespace-pre leading-relaxed text-neutral-200">{code}</pre>
              </div>
            );
          }
          return <span key={idx}>{renderInlineLinks(part, onNavigateToFile)}</span>;
        })}
      </div>
    );
  }

  return <div>{renderInlineLinks(content, onNavigateToFile)}</div>;
}

export function ChatPanel({
  projectId,
  userId,
  userName,
  userAvatar,
  onNewMessageReceived,
  onOpenMediaInEditor,
  onNavigateToFile,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [previewingMedia, setPreviewingMedia] = useState<MediaPreviewItem | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Fetch initial persistent chat history
  useEffect(() => {
    let isMounted = true;
    DataService.getMessages(projectId).then((msgs) => {
      if (isMounted) {
        setMessages(msgs);
        setLoading(false);
        setTimeout(scrollToBottom, 100);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  // 2. Connect to real-time chat room WebSocket using centralized config
  useEffect(() => {
    const wsUrl = config.buildWsUrl('/comm', { projectId });
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chat_message' && data.message) {
          const newMsg: ChatMessage = data.message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(scrollToBottom, 50);
          if (onNewMessageReceived && newMsg.user_id !== userId) {
            onNewMessageReceived();
          }
        }
      } catch (err) {}
    };

    return () => {
      ws.close();
    };
  }, [projectId, userId, onNewMessageReceived]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let type: 'image' | 'video' | 'audio' | 'file' = 'file';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    else if (file.type.startsWith('audio/')) type = 'audio';

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPendingMedia({
        file,
        previewUrl: URL.createObjectURL(file),
        base64,
        type,
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !pendingMedia) || sending) return;

    const content = inputText.trim() || (pendingMedia ? `Shared ${pendingMedia.type}: ${pendingMedia.name}` : '');
    const mediaPayload = pendingMedia
      ? {
          type: pendingMedia.type,
          url: pendingMedia.base64,
          name: pendingMedia.name,
        }
      : undefined;

    setInputText('');
    setPendingMedia(null);
    setSending(true);

    try {
      // 1. Persist to Supabase / Storage
      const saved = await DataService.sendMessage(
        projectId,
        userId,
        userName,
        userAvatar,
        content,
        mediaPayload
      );

      // 2. Update local state immediately
      setMessages((prev) => {
        if (prev.some((m) => m.id === saved.id)) return prev;
        return [...prev, saved];
      });
      setTimeout(scrollToBottom, 50);

      // 3. Broadcast in real time via WebSocket
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'chat_message',
            message: saved,
          })
        );
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div 
      className="flex flex-col h-full w-full select-none overflow-hidden relative"
      style={{
        backgroundColor: 'var(--ide-dock)',
        color: 'var(--ide-text)',
      }}
    >
      {/* Messages Scroll Area */}
      <div className="flex-1 w-full overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: 'var(--ide-text-muted)' }}>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs">Loading chat history...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--ide-text-muted)' }}>
            <div className="p-3 rounded-full border shadow-sm" style={{ backgroundColor: 'var(--ide-card-bg)', borderColor: 'var(--ide-border)' }}>
              <MessageSquare className="w-6 h-6" style={{ color: 'var(--ide-text-muted)' }} />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold" style={{ color: 'var(--ide-text)' }}>No messages yet</p>
              <p className="text-[11px]" style={{ color: 'var(--ide-text-muted)' }}>Start the conversation with your team!</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === userId;
            const timeStr = formatTime(msg.created_at);

            return (
              <div
                key={msg.id}
                className={`flex flex-col w-full ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`flex items-baseline gap-2 mb-1 px-1 text-[11px] ${
                    isMe ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <span className="font-semibold" style={{ color: 'var(--ide-text)' }}>
                    {isMe ? 'You' : msg.user_name}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--ide-text-muted)' }}>{timeStr}</span>
                </div>

                <div
                  className={`flex items-end gap-2 max-w-full md:max-w-[85%] ${
                    isMe ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {!isMe && (
                    <div 
                      className="w-7 h-7 rounded-full border flex items-center justify-center text-xs font-semibold flex-shrink-0 overflow-hidden"
                      style={{
                        backgroundColor: 'var(--ide-card-bg)',
                        borderColor: 'var(--ide-border)',
                        color: 'var(--ide-text)',
                      }}
                    >
                      {msg.user_avatar ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={msg.user_avatar}
                          alt={msg.user_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        msg.user_name[0]?.toUpperCase() || '?'
                      )}
                    </div>
                  )}

                  <div
                    className={`px-3 py-2 rounded-2xl text-xs leading-relaxed break-words shadow-sm flex flex-col gap-2 ${
                      isMe
                        ? 'bg-sky-600 text-white rounded-tr-none'
                        : 'border rounded-tl-none'
                    }`}
                    style={{
                      backgroundColor: isMe ? undefined : 'var(--ide-card-bg)',
                      borderColor: isMe ? undefined : 'var(--ide-border)',
                      color: isMe ? undefined : 'var(--ide-text)',
                    }}
                  >
                    {/* Media Attachment Rendering */}
                    {msg.media_url && (
                      <div className="rounded-xl overflow-hidden bg-black/40 border border-black/30 my-0.5 max-w-xl lg:max-w-2xl w-full group relative">
                        {msg.media_type === 'image' && (
                          <div className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={msg.media_url}
                              alt={msg.media_name || 'image'}
                              className="max-h-60 w-full object-contain rounded cursor-pointer hover:opacity-95 transition-opacity"
                              onClick={() => setPreviewingMedia({
                                name: msg.media_name || 'Image Attachment',
                                url: msg.media_url!,
                                type: 'image',
                                senderName: msg.user_name,
                                timestamp: timeStr,
                              })}
                            />
                            {/* Hover toolbar overlay */}
                            <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 backdrop-blur-sm p-1 rounded-lg border border-white/10">
                              <button
                                onClick={() => setPreviewingMedia({
                                  name: msg.media_name || 'Image Attachment',
                                  url: msg.media_url!,
                                  type: 'image',
                                  senderName: msg.user_name,
                                  timestamp: timeStr,
                                })}
                                title="View Inside Project"
                                className="p-1 text-white hover:bg-white/20 rounded transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {onOpenMediaInEditor && (
                                <button
                                  onClick={() => onOpenMediaInEditor({
                                    name: msg.media_name || 'image.png',
                                    url: msg.media_url!,
                                    type: 'image',
                                  })}
                                  title="Open in Workspace Editor Tab"
                                  className="p-1 text-sky-300 hover:bg-white/20 rounded transition-colors"
                                >
                                  <Layers className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <a
                                href={msg.media_url}
                                download={msg.media_name || 'image.png'}
                                className="p-1 text-white hover:bg-white/20 rounded transition-colors"
                                title="Download"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        )}

                        {msg.media_type === 'video' && (
                          <div className="relative">
                            <video
                              controls
                              playsInline
                              src={msg.media_url}
                              className="max-h-64 w-full rounded bg-black"
                            />
                            <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#1a1a1a] border-t border-black/20 text-[11px]">
                              <span className="truncate text-neutral-300">{msg.media_name || 'Video'}</span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setPreviewingMedia({
                                    name: msg.media_name || 'Video Attachment',
                                    url: msg.media_url!,
                                    type: 'video',
                                    senderName: msg.user_name,
                                    timestamp: timeStr,
                                  })}
                                  title="View Inside Project Modal"
                                  className="flex items-center gap-1 hover:text-white text-neutral-400"
                                >
                                  <Maximize2 className="w-3 h-3" />
                                  <span>View</span>
                                </button>
                                {onOpenMediaInEditor && (
                                  <button
                                    onClick={() => onOpenMediaInEditor({
                                      name: msg.media_name || 'video.mp4',
                                      url: msg.media_url!,
                                      type: 'video',
                                    })}
                                    title="Open in Workspace Tab"
                                    className="flex items-center gap-1 hover:text-sky-300 text-sky-400 font-medium"
                                  >
                                    <Layers className="w-3 h-3" />
                                    <span>Tab</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {msg.media_type === 'audio' && (
                          <div className="p-2 flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="truncate font-medium text-neutral-300">{msg.media_name || 'Audio file'}</span>
                              {onOpenMediaInEditor && (
                                <button
                                  onClick={() => onOpenMediaInEditor({
                                    name: msg.media_name || 'audio.mp3',
                                    url: msg.media_url!,
                                    type: 'audio',
                                  })}
                                  title="Open in Workspace Tab"
                                  className="flex items-center gap-1 text-sky-400 hover:text-sky-300 text-[10px]"
                                >
                                  <Layers className="w-3 h-3" />
                                  <span>Open Tab</span>
                                </button>
                              )}
                            </div>
                            <audio
                              controls
                              src={msg.media_url}
                              className="w-full h-8"
                            />
                          </div>
                        )}

                        {msg.media_type === 'file' && (
                          <div className="flex items-center gap-2.5 p-2.5">
                            <FileText className="w-6 h-6 text-sky-300 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate text-neutral-200">{msg.media_name || 'Download file'}</p>
                              <p className="text-[10px] text-neutral-400">Attached file</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setPreviewingMedia({
                                  name: msg.media_name || 'Document',
                                  url: msg.media_url!,
                                  type: 'file',
                                  senderName: msg.user_name,
                                  timestamp: timeStr,
                                })}
                                title="View in Project"
                                className="p-1 rounded hover:bg-white/20 text-neutral-300 hover:text-white transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {onOpenMediaInEditor && (
                                <button
                                  onClick={() => onOpenMediaInEditor({
                                    name: msg.media_name || 'attachment.txt',
                                    url: msg.media_url!,
                                    type: 'file',
                                  })}
                                  title="Open in Workspace Editor Tab"
                                  className="p-1 rounded hover:bg-white/20 text-sky-300 hover:text-white transition-colors"
                                >
                                  <Layers className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <a
                                href={msg.media_url}
                                download={msg.media_name || 'download'}
                                className="p-1 rounded hover:bg-white/20 text-white transition-colors"
                                title="Download File"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Text content */}
                    {(!msg.media_url || msg.content !== `Shared ${msg.media_type}: ${msg.media_name}`) && (
                      <DeveloperMessageText content={msg.content} onNavigateToFile={onNavigateToFile} />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Media Attachment Preview Banner before sending */}
      {pendingMedia && (
        <div 
          className="px-3 py-2 border-t flex items-center justify-between gap-2"
          style={{
            backgroundColor: 'var(--ide-dock-header)',
            borderColor: 'var(--ide-border)',
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {pendingMedia.type === 'image' ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={pendingMedia.previewUrl} alt="preview" className="w-10 h-10 object-cover rounded border" style={{ borderColor: 'var(--ide-border)' }} />
            ) : pendingMedia.type === 'video' ? (
              <div className="w-10 h-10 rounded bg-purple-900/40 border border-purple-500/50 flex items-center justify-center">
                <Film className="w-5 h-5 text-purple-300" />
              </div>
            ) : pendingMedia.type === 'audio' ? (
              <div className="w-10 h-10 rounded bg-amber-900/40 border border-amber-500/50 flex items-center justify-center">
                <Music className="w-5 h-5 text-amber-300" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded bg-sky-900/40 border border-sky-500/50 flex items-center justify-center">
                <FileText className="w-5 h-5 text-sky-300" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate max-w-[200px]" style={{ color: 'var(--ide-text)' }}>{pendingMedia.name}</p>
              <p className="text-[10px]" style={{ color: 'var(--ide-text-muted)' }}>{pendingMedia.size} &bull; {pendingMedia.type.toUpperCase()}</p>
            </div>
          </div>
          <button
            onClick={() => setPendingMedia(null)}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--ide-text-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input / Attachment Bar */}
      <form 
        onSubmit={handleSendMessage} 
        className="p-3 border-t flex items-center gap-2"
        style={{
          backgroundColor: 'var(--ide-dock-header)',
          borderColor: 'var(--ide-border)',
        }}
      >
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.txt,.md,.json,.zip"
        />

        {/* Attachment Options */}
        <div className="flex items-center gap-1" style={{ color: 'var(--ide-text-muted)' }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file or image"
            className="p-1.5 hover:opacity-80 rounded-lg transition-colors"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = 'image/*';
                fileInputRef.current.click();
              }
            }}
            title="Attach photo/screenshot"
            className="p-1.5 hover:opacity-80 rounded-lg transition-colors"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Chat Text Input */}
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={pendingMedia ? `Add a caption for ${pendingMedia.name}...` : 'Type a message...'}
          className="flex-1 border focus:border-sky-500 rounded-lg px-3 py-1.5 text-xs focus:outline-none transition-colors"
          style={{
            backgroundColor: 'var(--ide-input-bg)',
            borderColor: 'var(--ide-border)',
            color: 'var(--ide-text)',
          }}
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={(!inputText.trim() && !pendingMedia) || sending}
          className="p-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-30 disabled:hover:bg-sky-600 text-white rounded-lg transition-colors flex items-center justify-center flex-shrink-0 shadow-sm"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>

      {/* In-Project Media Preview Modal */}
      <MediaPreviewModal
        media={previewingMedia}
        onClose={() => setPreviewingMedia(null)}
        onOpenInEditor={onOpenMediaInEditor}
      />
    </div>
  );
}

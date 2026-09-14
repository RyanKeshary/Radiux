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
  Eye
} from 'lucide-react';
import { MediaPreviewModal, MediaPreviewItem } from './MediaPreviewModal';

interface ChatPanelProps {
  projectId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  onNewMessageReceived?: () => void;
  onOpenMediaInEditor?: (media: { name: string; url: string; type: 'image' | 'video' | 'audio' | 'file' }) => void;
}

interface PendingMedia {
  file: File;
  previewUrl: string;
  base64: string;
  type: 'image' | 'video' | 'audio' | 'file';
  name: string;
  size: string;
}

export function ChatPanel({
  projectId,
  userId,
  userName,
  userAvatar,
  onNewMessageReceived,
  onOpenMediaInEditor,
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
    <div className="flex flex-col h-full w-full bg-[#181818] text-neutral-200 select-none overflow-hidden relative">
      {/* Messages Scroll Area */}
      <div className="flex-1 w-full overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs">Loading chat history...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-3">
            <div className="p-3 bg-[#252526] rounded-full">
              <MessageSquare className="w-6 h-6 text-neutral-400" />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-neutral-300">No messages yet</p>
              <p className="text-[11px] text-neutral-500">Start the conversation with your team!</p>
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
                  <span className="font-semibold text-neutral-300">
                    {isMe ? 'You' : msg.user_name}
                  </span>
                  <span className="text-neutral-500 text-[10px]">{timeStr}</span>
                </div>

                <div
                  className={`flex items-end gap-2 max-w-full md:max-w-[85%] ${
                    isMe ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {!isMe && (
                    <div className="w-7 h-7 rounded-full bg-[#333333] border border-neutral-700 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 overflow-hidden">
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
                        : 'bg-[#252526] text-neutral-200 border border-[#3c3c3c] rounded-tl-none'
                    }`}
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
                      <span>{msg.content}</span>
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
        <div className="px-3 py-2 bg-[#2a2d2e] border-t border-[#3c3c3c] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {pendingMedia.type === 'image' ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={pendingMedia.previewUrl} alt="preview" className="w-10 h-10 object-cover rounded border border-neutral-600" />
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
              <p className="text-xs font-semibold text-white truncate max-w-[200px]">{pendingMedia.name}</p>
              <p className="text-[10px] text-neutral-400">{pendingMedia.size} &bull; {pendingMedia.type.toUpperCase()}</p>
            </div>
          </div>
          <button
            onClick={() => setPendingMedia(null)}
            className="p-1 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input / Attachment Bar */}
      <form onSubmit={handleSendMessage} className="p-3 bg-[#202020] border-t border-[#333333] flex items-center gap-2">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.txt,.md,.json,.zip"
        />

        {/* Attachment Options */}
        <div className="flex items-center gap-1 text-neutral-400">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file or image"
            className="p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
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
            className="p-1.5 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
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
          className="flex-1 bg-[#2c2c2c] border border-[#3e3e3e] focus:border-sky-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none transition-colors"
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

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '@/lib/types';
import { DataService } from '@/lib/data-service';
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
  ExternalLink
} from 'lucide-react';

interface ChatPanelProps {
  projectId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  onNewMessageReceived?: () => void;
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
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
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

  // 2. Connect to real-time chat room WebSocket
  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:1234/comm?projectId=${projectId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chat_message' && data.message) {
          const newMsg: ChatMessage = data.message;
          setMessages((prev) => {
            // Avoid duplicate message if already added locally
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

    // Detect media type
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
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#181818] overflow-hidden select-none">
      {/* Hidden file input for media attachment */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip,.txt"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
            <span className="text-xs">Loading project messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-2 select-none py-8">
            <div className="w-10 h-10 rounded-full bg-[#252526] border border-[#3c3c3c] flex items-center justify-center text-sky-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <p className="text-xs font-medium text-neutral-400">No messages yet</p>
            <p className="text-[11px] text-neutral-600 max-w-[220px] text-center">
              Send a message or media file to start collaborating with project members in real time.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === userId;
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 max-w-[85%] ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* User Avatar */}
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5 shadow">
                  {msg.user_name.charAt(0).toUpperCase()}
                </div>

                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 mb-0.5 px-0.5">
                    <span className="text-[11px] font-semibold text-neutral-300">
                      {isMe ? 'You' : msg.user_name}
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`px-3 py-2 rounded-2xl text-xs leading-relaxed break-words shadow-sm flex flex-col gap-2 ${
                      isMe
                        ? 'bg-sky-600 text-white rounded-tr-none'
                        : 'bg-[#252526] text-neutral-200 border border-[#3c3c3c] rounded-tl-none'
                    }`}
                  >
                    {/* Media Attachment Rendering */}
                    {msg.media_url && (
                      <div className="rounded-lg overflow-hidden bg-black/30 border border-black/20 my-0.5 max-w-sm">
                        {msg.media_type === 'image' && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={msg.media_url}
                            alt={msg.media_name || 'image'}
                            className="max-h-60 w-full object-contain rounded cursor-pointer hover:opacity-95 transition-opacity"
                            onClick={() => window.open(msg.media_url, '_blank')}
                          />
                        )}

                        {msg.media_type === 'video' && (
                          <video
                            controls
                            playsInline
                            src={msg.media_url}
                            className="max-h-64 w-full rounded bg-black"
                          />
                        )}

                        {msg.media_type === 'audio' && (
                          <audio
                            controls
                            src={msg.media_url}
                            className="w-full p-1"
                          />
                        )}

                        {msg.media_type === 'file' && (
                          <div className="flex items-center gap-2 p-2">
                            <FileText className="w-6 h-6 text-sky-300 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{msg.media_name || 'Download file'}</p>
                            </div>
                            <a
                              href={msg.media_url}
                              download={msg.media_name || 'download'}
                              className="p-1 rounded hover:bg-white/20 text-white transition-colors"
                              title="Download File"
                            >
                              <Download className="w-4 h-4" />
                            </a>
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
              <div className="w-10 h-10 rounded bg-purple-900/40 border border-purple-500/40 flex items-center justify-center text-purple-300">
                <Film className="w-5 h-5" />
              </div>
            ) : pendingMedia.type === 'audio' ? (
              <div className="w-10 h-10 rounded bg-amber-900/40 border border-amber-500/40 flex items-center justify-center text-amber-300">
                <Music className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded bg-sky-900/40 border border-sky-500/40 flex items-center justify-center text-sky-300">
                <FileText className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate max-w-[200px]">{pendingMedia.name}</p>
              <p className="text-[10px] text-neutral-400">{pendingMedia.size} &bull; {pendingMedia.type}</p>
            </div>
          </div>
          <button
            onClick={() => setPendingMedia(null)}
            className="p-1 rounded hover:bg-[#383b3d] text-neutral-400 hover:text-white"
            title="Remove attachment"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={handleSendMessage}
        className="h-12 bg-[#252526] border-t border-[#333333] px-3 flex items-center gap-2 flex-shrink-0"
      >
        {/* Media Upload Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Attach image, video, audio or file"
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#333333] transition-colors"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={pendingMedia ? "Add a caption..." : "Type a message or attach media..."}
          className="flex-1 bg-[#181818] text-white border border-[#3c3c3c] focus:border-sky-500 px-3 py-1.5 rounded-lg text-xs outline-none transition-colors placeholder:text-neutral-500"
        />

        <button
          type="submit"
          disabled={(!inputText.trim() && !pendingMedia) || sending}
          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors shadow"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          <span>Send</span>
        </button>
      </form>
    </div>
  );
}

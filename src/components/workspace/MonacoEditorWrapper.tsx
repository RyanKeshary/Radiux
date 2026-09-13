'use client';

import React, { useEffect, useRef, useState } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import { FileItem, LanguageType, PresenceUser, getUserColor } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { DataService } from '@/lib/data-service';
import { Loader2, Wifi, WifiOff } from 'lucide-react';

interface MonacoEditorWrapperProps {
  projectId: string;
  file: FileItem;
  onContentSaved?: () => void;
}

export function MonacoEditorWrapper({
  projectId,
  file,
  onContentSaved,
}: MonacoEditorWrapperProps) {
  const { user } = useAuth();
  const [synced, setSynced] = useState(false);
  const [editorReady, setEditorReady] = useState(false);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced persistence to database
  const queuePersist = (text: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await DataService.updateFileContent(file.id, text);
        if (onContentSaved) onContentSaved();
      } catch (err) {
        console.error('Failed to save file content to storage:', err);
      }
    }, 1500);
  };

  useEffect(() => {
    if (!editorReady || !editorRef.current || !monacoRef.current) return;

    // Clean up previous Yjs connections
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }
    if (providerRef.current) {
      providerRef.current.destroy();
      providerRef.current = null;
    }
    if (ydocRef.current) {
      ydocRef.current.destroy();
      ydocRef.current = null;
    }

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Room name isolated per project and file:
    const roomName = `project-${projectId}-file-${file.id}`;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234';

    const provider = new WebsocketProvider(wsUrl, roomName, ydoc);
    providerRef.current = provider;

    const ytext = ydoc.getText('monaco');

    // Setup local awareness presence
    const userColor = getUserColor(user?.id || 'guest');
    provider.awareness.setLocalStateField('user', {
      name: user?.full_name || 'Guest Developer',
      color: userColor,
      fileId: file.id,
    });

    provider.on('status', (event: any) => {
      setSynced(event.status === 'connected');
    });

    provider.on('sync', (isSynced: boolean) => {
      setSynced(isSynced);
      // If doc is completely fresh in Yjs room, seed with initial content
      if (ytext.toString().length === 0 && file.content) {
        ytext.insert(0, file.content);
      }
    });

    // Listen for doc changes and schedule debounced persistence
    ytext.observe(() => {
      queuePersist(ytext.toString());
    });

    // Bind Monaco model to Yjs text CRDT
    const editor = editorRef.current;
    const model = editor.getModel();

    if (model) {
      const binding = new MonacoBinding(
        ytext,
        model,
        new Set([editor]),
        provider.awareness
      );
      bindingRef.current = binding;
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
      if (ydocRef.current) {
        ydocRef.current.destroy();
        ydocRef.current = null;
      }
    };
  }, [file.id, projectId, editorReady, user?.id]);

  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setEditorReady(true);
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#1e1e1e]">
      {/* Sync Status Banner */}
      <div className="absolute top-2 right-4 z-10 flex items-center gap-2 bg-[#252526]/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-[#3c3c3c] text-[10px] pointer-events-none">
        {synced ? (
          <span className="flex items-center gap-1 text-emerald-400 font-medium">
            <Wifi className="w-3 h-3" /> Live Synced
          </span>
        ) : (
          <span className="flex items-center gap-1 text-amber-400 font-medium">
            <WifiOff className="w-3 h-3 animate-pulse" /> Connecting to peers...
          </span>
        )}
      </div>

      <div className="flex-1 w-full h-full">
        <Editor
          height="100%"
          language={file.language || 'plaintext'}
          theme="vs-dark"
          defaultValue={file.content || ''}
          onMount={handleEditorDidMount}
          options={{
            fontSize: 14,
            fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
            minimap: { enabled: true },
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            renderWhitespace: 'selection',
            cursorBlinking: 'smooth',
            smoothScrolling: true,
          }}
          loading={
            <div className="flex items-center justify-center h-full bg-[#1e1e1e] text-neutral-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
              <span>Loading Monaco Editor...</span>
            </div>
          }
        />
      </div>
    </div>
  );
}

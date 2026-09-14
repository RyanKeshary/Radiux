'use client';

import React, { useEffect, useRef, useState } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import { FileItem, getUserColor } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import { DataService } from '@/lib/data-service';
import { EditorSettings } from './EditorSettingsModal';
import { Loader2, Wifi, WifiOff, CheckCircle2 } from 'lucide-react';

interface MonacoEditorWrapperProps {
  projectId: string;
  file: FileItem;
  settings: EditorSettings;
  onContentSaved?: (text: string) => void;
  onCursorChange?: (line: number, col: number) => void;
}

export function MonacoEditorWrapper({
  projectId,
  file,
  settings,
  onContentSaved,
  onCursorChange,
}: MonacoEditorWrapperProps) {
  const { user } = useAuth();
  const [synced, setSynced] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [editorReady, setEditorReady] = useState(false);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingTextRef = useRef<string | null>(null);
  const fileIdRef = useRef(file.id);
  fileIdRef.current = file.id;

  // Flush pending changes to Supabase storage immediately
  const flushPersist = async (targetFileId: string, text: string) => {
    try {
      await DataService.updateFileContent(targetFileId, text);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to save file content to storage:', err);
      setSaveStatus('saved');
    }
  };

  // Debounced persistence to database & workspace disk
  const queuePersist = (text: string) => {
    pendingTextRef.current = text;
    setSaveStatus('saving');
    // Immediately notify workspace sync with fresh content
    if (onContentSaved) onContentSaved(text);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      const currentText = pendingTextRef.current;
      pendingTextRef.current = null;
      if (currentText !== null) {
        await flushPersist(file.id, currentText);
      }
    }, 400);
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

    // Room name isolated per project and file
    const roomName = `project-${projectId}-file-${file.id}`;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234';

    const provider = new WebsocketProvider(wsUrl, roomName, ydoc);
    providerRef.current = provider;

    const ytext = ydoc.getText('monaco');

    // Setup local awareness presence with active file and user details
    const userColor = getUserColor(user?.id || 'guest');
    provider.awareness.setLocalStateField('user', {
      id: user?.id || 'guest',
      name: user?.full_name || 'Guest Developer',
      color: userColor,
      fileId: file.id,
      fileName: file.name,
    });

    provider.on('status', (event: any) => {
      setSynced(event.status === 'connected');
    });

    // Listen for doc changes and schedule debounced persistence
    ytext.observe(() => {
      queuePersist(ytext.toString());
    });

    const attachBinding = () => {
      if (bindingRef.current) return;
      const editor = editorRef.current;
      if (!editor) return;
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
    };

    provider.on('sync', (isSynced: boolean) => {
      setSynced(isSynced);
      if (isSynced) {
        // Seed content only if the Yjs CRDT room is completely empty
        if (ytext.toString().length === 0 && file.content) {
          ytext.insert(0, file.content);
        }
        attachBinding();
      }
    });

    // If provider is already synced before listener
    if (provider.synced) {
      if (ytext.toString().length === 0 && file.content) {
        ytext.insert(0, file.content);
      }
      attachBinding();
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      if (pendingTextRef.current !== null) {
        const textToSave = pendingTextRef.current;
        pendingTextRef.current = null;
        DataService.updateFileContent(fileIdRef.current, textToSave).catch((err) => {
          console.error('Error saving pending file on unmount:', err);
        });
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
  }, [file.id, projectId, editorReady, user?.id, user?.full_name]);

  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setEditorReady(true);

    // Enable rich JS/TS and HTML intellisense
    try {
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTextExtensions: true,
        allowJs: true,
        checkJs: true,
      });
    } catch (e) {}

    editor.onDidChangeCursorPosition((e: any) => {
      if (onCursorChange) {
        onCursorChange(e.position.lineNumber, e.position.column);
      }
    });
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#1e1e1e]">
      {/* Top Floating Status Indicator */}
      <div className="absolute top-2 right-4 z-10 flex items-center gap-2 bg-[#252526]/85 backdrop-blur-md px-3 py-1 rounded-full border border-[#3c3c3c] text-[11px] pointer-events-none shadow-lg">
        {saveStatus === 'saving' ? (
          <span className="flex items-center gap-1.5 text-amber-400 font-medium">
            <Loader2 className="w-3 h-3 animate-spin" /> Saving...
          </span>
        ) : (
          <span className="flex items-center gap-1 text-neutral-400">
            <CheckCircle2 className="w-3 h-3 text-sky-400" /> Saved
          </span>
        )}

        <span className="text-neutral-600">|</span>

        {synced ? (
          <span className="flex items-center gap-1 text-emerald-400 font-medium">
            <Wifi className="w-3 h-3" /> Live
          </span>
        ) : (
          <span className="flex items-center gap-1 text-amber-400 font-medium">
            <WifiOff className="w-3 h-3 animate-pulse" /> Reconnecting...
          </span>
        )}
      </div>

      <div className="flex-1 w-full h-full">
        <Editor
          height="100%"
          path={file.name}
          language={file.language || 'plaintext'}
          theme={settings.theme}
          defaultValue={file.content || ''}
          onMount={handleEditorDidMount}
          options={{
            fontSize: settings.fontSize,
            fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
            minimap: { enabled: settings.minimap },
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: settings.tabSize,
            wordWrap: settings.wordWrap,
            renderWhitespace: 'selection',
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            // Full IntelliSense and Autocomplete Settings
            quickSuggestions: { other: true, comments: true, strings: true },
            parameterHints: { enabled: true },
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            tabCompletion: 'on',
            wordBasedSuggestions: 'allDocuments',
            snippetSuggestions: 'top',
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

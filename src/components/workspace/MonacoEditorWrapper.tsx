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
import { registerMonacoThemes, THEMES, ThemeId } from '@/lib/themes';
import { ProblemItem } from './ProblemsPanel';
import { config } from '@/lib/config';
import { Loader2, Wifi, WifiOff, CheckCircle2 } from 'lucide-react';

interface MonacoEditorWrapperProps {
  projectId: string;
  file: FileItem;
  settings: EditorSettings;
  onContentSaved?: (text: string) => void;
  onCursorChange?: (line: number, col: number) => void;
  onProblemsChange?: (problems: ProblemItem[]) => void;
  targetLocation?: { line: number; col?: number } | null;
  onCloseActiveTab?: () => void;
  onQuickOpen?: () => void;
  onCommandPalette?: () => void;
  onToggleSidebar?: () => void;
  onToggleDock?: () => void;
  onSave?: () => void;
}

// Remote Collaborator Cursor Content Widget for Monaco Editor (Requirement 4)
class RemoteCursorWidget {
  private id: string;
  private domNode: HTMLElement;
  private position: { lineNumber: number; column: number } | null = null;
  private preference: number[];

  constructor(clientID: number, userName: string, userColor: string, position: { lineNumber: number; column: number }) {
    this.id = `radiux-remote-cursor-${clientID}`;
    this.position = position;
    this.preference = [0]; // monaco.editor.ContentWidgetPositionPreference.EXACT

    this.domNode = document.createElement('div');
    this.domNode.className = 'radiux-remote-cursor-widget';
    this.domNode.style.position = 'absolute';
    this.domNode.style.pointerEvents = 'none';
    this.domNode.style.zIndex = '50';
    this.domNode.style.willChange = 'transform';

    // Caret line
    const caret = document.createElement('div');
    caret.className = 'radiux-remote-caret';
    caret.style.position = 'absolute';
    caret.style.left = '0px';
    caret.style.top = '0px';
    caret.style.width = '2px';
    caret.style.height = '18px';
    caret.style.backgroundColor = userColor;
    caret.style.borderRadius = '1px';
    caret.style.boxShadow = `0 0 4px ${userColor}`;

    // Caret accent dot
    const dot = document.createElement('div');
    dot.className = 'radiux-remote-dot';
    dot.style.position = 'absolute';
    dot.style.left = '-1px';
    dot.style.top = '-2px';
    dot.style.width = '4px';
    dot.style.height = '4px';
    dot.style.borderRadius = '50%';
    dot.style.backgroundColor = userColor;

    // Floating name tag badge
    const badge = document.createElement('div');
    badge.className = 'radiux-remote-name-tag';
    badge.textContent = userName;
    badge.style.position = 'absolute';
    badge.style.left = '0px';
    badge.style.top = position.lineNumber <= 1 ? '19px' : '-18px';
    badge.style.backgroundColor = userColor;
    badge.style.color = '#ffffff';
    badge.style.fontSize = '10px';
    badge.style.fontWeight = '600';
    badge.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    badge.style.padding = '1px 5px';
    badge.style.borderRadius = position.lineNumber <= 1 ? '0 3px 3px 3px' : '3px 3px 3px 0';
    badge.style.whiteSpace = 'nowrap';
    badge.style.boxShadow = '0 1px 4px rgba(0,0,0,0.4)';
    badge.style.lineHeight = '13px';
    badge.style.pointerEvents = 'none';
    badge.style.userSelect = 'none';

    this.domNode.appendChild(caret);
    this.domNode.appendChild(dot);
    this.domNode.appendChild(badge);
  }

  update(userName: string, userColor: string, position: { lineNumber: number; column: number }) {
    this.position = position;
    const badge = this.domNode.querySelector('.radiux-remote-name-tag') as HTMLElement;
    if (badge) {
      badge.textContent = userName;
      badge.style.backgroundColor = userColor;
      badge.style.top = position.lineNumber <= 1 ? '19px' : '-18px';
      badge.style.borderRadius = position.lineNumber <= 1 ? '0 3px 3px 3px' : '3px 3px 3px 0';
    }
    const caret = this.domNode.querySelector('.radiux-remote-caret') as HTMLElement;
    if (caret) {
      caret.style.backgroundColor = userColor;
      caret.style.boxShadow = `0 0 4px ${userColor}`;
    }
    const dot = this.domNode.querySelector('.radiux-remote-dot') as HTMLElement;
    if (dot) {
      dot.style.backgroundColor = userColor;
    }
  }

  getId(): string {
    return this.id;
  }

  getDomNode(): HTMLElement {
    return this.domNode;
  }

  getPosition(): { position: { lineNumber: number; column: number } | null; preference: number[] } {
    return {
      position: this.position,
      preference: this.preference,
    };
  }
}

export function MonacoEditorWrapper({
  projectId,
  file,
  settings,
  onContentSaved,
  onCursorChange,
  onProblemsChange,
  targetLocation,
  onCloseActiveTab,
  onQuickOpen,
  onCommandPalette,
  onToggleSidebar,
  onToggleDock,
  onSave,
}: MonacoEditorWrapperProps) {
  const { user } = useAuth();
  const [synced, setSynced] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [editorReady, setEditorReady] = useState(false);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const ytextRef = useRef<Y.Text | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingTextRef = useRef<string | null>(null);
  const fileIdRef = useRef(file.id);
  fileIdRef.current = file.id;

  // Remote cursor widgets and decorations refs
  const remoteWidgetsRef = useRef<Map<number, RemoteCursorWidget>>(new Map());
  const remoteDecorationsRef = useRef<string[]>([]);
  const selectionListenerRef = useRef<any>(null);
  const updateRemoteCursorsRef = useRef<(() => void) | null>(null);

  // Jump to specific line/col when requested
  useEffect(() => {
    if (targetLocation && editorRef.current) {
      try {
        editorRef.current.revealLineInCenter(targetLocation.line);
        editorRef.current.setPosition({
          lineNumber: targetLocation.line,
          column: targetLocation.col || 1,
        });
        editorRef.current.focus();
      } catch (e) {}
    }
  }, [targetLocation]);

  // Dynamically update Monaco theme when settings.theme changes
  useEffect(() => {
    if (editorReady && monacoRef.current) {
      const themeConfig = THEMES[settings.theme as ThemeId];
      const monacoTheme = themeConfig ? themeConfig.monacoTheme : settings.theme;
      monacoRef.current.editor.setTheme(monacoTheme);
    }
  }, [settings.theme, editorReady]);

  // Dynamically update Monaco editor settings (fontSize, fontFamily, tabSize, wordWrap, minimap)
  useEffect(() => {
    if (editorReady && editorRef.current) {
      editorRef.current.updateOptions({
        fontSize: settings.fontSize,
        fontFamily: settings.fontFamily || "'Fira Code', 'Cascadia Code', Consolas, monospace",
        tabSize: settings.tabSize,
        wordWrap: settings.wordWrap,
        minimap: { enabled: settings.minimap },
      });
    }
  }, [
    settings.fontSize,
    settings.fontFamily,
    settings.tabSize,
    settings.wordWrap,
    settings.minimap,
    editorReady,
  ]);

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

  // Handle showCollaboratorCursors setting toggle dynamically without disconnecting (Requirement 4E)
  useEffect(() => {
    if (updateRemoteCursorsRef.current) {
      updateRemoteCursorsRef.current();
    }
  }, [settings.showCollaboratorCursors]);

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
    const wsUrl = config.wsUrl;

    const provider = new WebsocketProvider(wsUrl, roomName, ydoc);
    providerRef.current = provider;

    const ytext = ydoc.getText('monaco');
    ytextRef.current = ytext;

    // Setup local awareness presence with active file and user details (Requirement 4B)
    const userColor = getUserColor(user?.id || 'guest');
    provider.awareness.setLocalStateField('user', {
      id: user?.id || 'guest',
      name: user?.full_name || 'Developer',
      color: userColor,
      colorLight: userColor + '33',
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

    // Dynamic CSS element for remote awareness cursor colors & selections
    const styleElementId = `yjs-cursor-styles-${projectId.replace(/[^a-zA-Z0-9_-]/g, '')}-${file.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    let styleEl = document.getElementById(styleElementId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleElementId;
      document.head.appendChild(styleEl);
    }

    // Publish local cursor position into awareness (Requirement 4C)
    const publishLocalCursor = (sel?: any) => {
      const editor = editorRef.current;
      if (!editor || !provider?.awareness) return;
      const currentSel = sel || editor.getSelection();
      if (!currentSel) return;

      const anchor = {
        lineNumber: currentSel.selectionStartLineNumber,
        column: currentSel.selectionStartColumn,
      };
      const head = {
        lineNumber: currentSel.positionLineNumber,
        column: currentSel.positionColumn,
      };

      provider.awareness.setLocalStateField('cursor', { anchor, head });

      // Also publish relative selection for cross-compatibility
      const model = editor.getModel();
      if (model && ytext) {
        try {
          const startOffset = model.getOffsetAt({ lineNumber: anchor.lineNumber, column: anchor.column });
          const endOffset = model.getOffsetAt({ lineNumber: head.lineNumber, column: head.column });
          const relStart = Y.createRelativePositionFromTypeIndex(ytext, startOffset);
          const relEnd = Y.createRelativePositionFromTypeIndex(ytext, endOffset);
          provider.awareness.setLocalStateField('selection', { anchor: relStart, head: relEnd });
        } catch (e) {}
      }
    };

    // Render remote collaborator cursors and selection highlights (Requirement 4D, 4E)
    const updateRemoteCursors = () => {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      if (!editor || !monaco || !provider?.awareness) return;

      // Settings toggle: if showCollaboratorCursors is false, remove all widgets & decorations
      if (settings.showCollaboratorCursors === false) {
        remoteWidgetsRef.current.forEach((widget) => {
          try {
            editor.removeContentWidget(widget);
          } catch (e) {}
        });
        remoteWidgetsRef.current.clear();
        remoteDecorationsRef.current = editor.deltaDecorations(remoteDecorationsRef.current, []);
        if (styleEl) styleEl.textContent = '';
        return;
      }

      const myClientId = provider.awareness.doc.clientID;
      const states = provider.awareness.getStates();
      const activeClients = new Set<number>();
      const newDecorations: any[] = [];
      let css = '';

      states.forEach((state: any, clientID: number) => {
        if (clientID === myClientId) return;
        if (!state.user) return;

        // Verify collaborator is viewing the same file
        if (state.user.fileId && state.user.fileId !== file.id) return;

        const uName = state.user.name || 'Collaborator';
        const uColor = state.user.color || getUserColor(state.user.id || String(clientID));

        let headPos = state.cursor?.head;
        let anchorPos = state.cursor?.anchor;

        // Relative selection fallback
        if (!headPos && state.selection && ydocRef.current && ytext && editor.getModel()) {
          try {
            const headAbs = Y.createAbsolutePositionFromRelativePosition(state.selection.head, ydocRef.current);
            if (headAbs && headAbs.type === ytext) {
              headPos = editor.getModel().getPositionAt(headAbs.index);
            }
            const anchorAbs = Y.createAbsolutePositionFromRelativePosition(state.selection.anchor, ydocRef.current);
            if (anchorAbs && anchorAbs.type === ytext) {
              anchorPos = editor.getModel().getPositionAt(anchorAbs.index);
            }
          } catch (e) {}
        }

        if (!headPos || !headPos.lineNumber || !headPos.column) return;

        activeClients.add(clientID);

        // 1. ContentWidget for Caret + Floating Name Tag
        const existingWidget = remoteWidgetsRef.current.get(clientID);
        if (existingWidget) {
          existingWidget.update(uName, uColor, headPos);
          editor.layoutContentWidget(existingWidget);
        } else {
          const newWidget = new RemoteCursorWidget(clientID, uName, uColor, headPos);
          remoteWidgetsRef.current.set(clientID, newWidget);
          editor.addContentWidget(newWidget);
        }

        // 2. Selection highlight
        if (anchorPos && (anchorPos.lineNumber !== headPos.lineNumber || anchorPos.column !== headPos.column)) {
          let startLine = anchorPos.lineNumber;
          let startCol = anchorPos.column;
          let endLine = headPos.lineNumber;
          let endCol = headPos.column;

          if (anchorPos.lineNumber > headPos.lineNumber || (anchorPos.lineNumber === headPos.lineNumber && anchorPos.column > headPos.column)) {
            startLine = headPos.lineNumber;
            startCol = headPos.column;
            endLine = anchorPos.lineNumber;
            endCol = anchorPos.column;
          }

          css += `
            .radiux-remote-selection-${clientID} {
              background-color: ${uColor}33 !important;
            }
          `;

          newDecorations.push({
            range: new monaco.Range(startLine, startCol, endLine, endCol),
            options: {
              className: `radiux-remote-selection radiux-remote-selection-${clientID}`,
              isWholeLine: false,
            },
          });
        }
      });

      // Clean up disconnected or navigated clients
      remoteWidgetsRef.current.forEach((widget, clientID) => {
        if (!activeClients.has(clientID)) {
          try {
            editor.removeContentWidget(widget);
          } catch (e) {}
          remoteWidgetsRef.current.delete(clientID);
        }
      });

      // Delta decorations for selections
      remoteDecorationsRef.current = editor.deltaDecorations(remoteDecorationsRef.current, newDecorations);

      if (styleEl) {
        styleEl.textContent = css;
      }
    };

    updateRemoteCursorsRef.current = updateRemoteCursors;
    provider.awareness.on('change', updateRemoteCursors);

    const attachBinding = () => {
      if (bindingRef.current) return;
      const editor = editorRef.current;
      if (!editor) return;
      const model = editor.getModel();
      if (model) {
        // Pass null for awareness to bypass y-monaco's broken CSS decorations
        const binding = new MonacoBinding(
          ytext,
          model,
          new Set([editor]),
          null
        );
        bindingRef.current = binding;

        // Publish local selection on cursor movement
        if (selectionListenerRef.current) {
          selectionListenerRef.current.dispose();
        }
        selectionListenerRef.current = editor.onDidChangeCursorSelection((e: any) => {
          publishLocalCursor(e.selection);
          if (onCursorChange) {
            onCursorChange(e.selection.positionLineNumber, e.selection.positionColumn);
          }
        });

        // Publish initial position immediately
        publishLocalCursor(editor.getSelection());

        // Update remote cursors
        updateRemoteCursors();
      }
    };

    provider.on('sync', (isSynced: boolean) => {
      setSynced(isSynced);
      if (isSynced) {
        if (ytext.toString().length === 0 && file.content) {
          ytext.insert(0, file.content);
        }
        attachBinding();
      }
    });

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
      if (selectionListenerRef.current) {
        selectionListenerRef.current.dispose();
        selectionListenerRef.current = null;
      }
      if (editorRef.current) {
        remoteWidgetsRef.current.forEach((widget) => {
          try {
            editorRef.current.removeContentWidget(widget);
          } catch (e) {}
        });
        remoteDecorationsRef.current = editorRef.current.deltaDecorations(remoteDecorationsRef.current, []);
      }
      remoteWidgetsRef.current.clear();
      if (provider.awareness) {
        try {
          provider.awareness.off('change', updateRemoteCursors);
          provider.awareness.setLocalState(null);
        } catch (e) {}
      }
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
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
      updateRemoteCursorsRef.current = null;
    };
  }, [file.id, projectId, editorReady, user?.id, user?.full_name]);

  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register custom themes
    registerMonacoThemes(monaco);

    // Apply active theme
    const themeConfig = THEMES[settings.theme as ThemeId];
    const targetTheme = themeConfig ? themeConfig.monacoTheme : settings.theme;
    monaco.editor.setTheme(targetTheme);

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

    // Listen to editor marker changes for Problems Panel
    const updateMarkers = () => {
      try {
        const markers = monaco.editor.getModelMarkers({});
        if (onProblemsChange) {
          const problems: ProblemItem[] = markers.map((m, idx) => ({
            id: `${file.id}-${idx}-${m.startLineNumber}-${m.startColumn}`,
            fileId: file.id,
            fileName: file.name,
            filePath: file.name,
            message: m.message,
            severity: m.severity === 8 ? 'error' : m.severity === 4 ? 'warning' : 'info',
            startLineNumber: m.startLineNumber,
            startColumn: m.startColumn,
            source: m.source,
          }));
          onProblemsChange(problems);
        }
      } catch (e) {}
    };

    monaco.editor.onDidChangeMarkers(() => {
      updateMarkers();
    });

    editor.onDidChangeCursorPosition((e: any) => {
      if (onCursorChange) {
        onCursorChange(e.position.lineNumber, e.position.column);
      }
    });

    // If initial target location is provided
    if (targetLocation) {
      editor.revealLineInCenter(targetLocation.line);
      editor.setPosition({
        lineNumber: targetLocation.line,
        column: targetLocation.col || 1,
      });
    }

    // Intercept browser-colliding shortcuts inside Monaco
    if (onCloseActiveTab) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, () => {
        onCloseActiveTab();
      });
    }
    if (onQuickOpen) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
        onQuickOpen();
      });
    }
    if (onCommandPalette) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, () => {
        onCommandPalette();
      });
    }
    if (onToggleSidebar) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
        onToggleSidebar();
      });
    }
    if (onToggleDock) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ, () => {
        onToggleDock();
      });
    }
    if (onSave) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onSave();
      });
    }

    // Direct keydown intercept for KeyW inside Monaco
    editor.onKeyDown((e: any) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd && e.keyCode === monaco.KeyCode.KeyW) {
        e.preventDefault();
        e.stopPropagation();
        if (onCloseActiveTab) onCloseActiveTab();
      }
    });
  };

  const currentThemeConfig = THEMES[settings.theme as ThemeId];
  const activeMonacoTheme = currentThemeConfig ? currentThemeConfig.monacoTheme : settings.theme;

  return (
    <div 
      className="relative w-full h-full flex flex-col"
      style={{ backgroundColor: 'var(--ide-bg)' }}
    >
      {/* Top Floating Status Indicator */}
      <div 
        className="absolute top-2 right-4 z-10 flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] pointer-events-none shadow-lg backdrop-blur-md"
        style={{
          backgroundColor: 'var(--ide-card-bg)',
          borderColor: 'var(--ide-border)',
        }}
      >
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

      <div className={`flex-1 w-full h-full ${settings.showCollaboratorCursors === false ? 'hide-remote-cursors' : ''}`}>
        <Editor
          height="100%"
          path={file.name}
          language={file.language || 'plaintext'}
          theme={activeMonacoTheme}
          defaultValue={file.content || ''}
          onMount={handleEditorDidMount}
          options={{
            fontSize: settings.fontSize,
            fontFamily: settings.fontFamily || "'Fira Code', 'Cascadia Code', Consolas, monospace",
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
            <div 
              className="flex items-center justify-center h-full gap-2"
              style={{ backgroundColor: 'var(--ide-bg)', color: 'var(--ide-text-muted)' }}
            >
              <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
              <span>Loading Monaco Editor...</span>
            </div>
          }
        />
      </div>
    </div>
  );
}

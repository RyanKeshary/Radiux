/**
 * Radiux AI Coding Agent Type Definitions
 * Agnostic architecture supporting provider abstraction, tool calling, and permissions.
 */

export type AIPermissionMode = 'READ_ONLY' | 'ASSISTED' | 'AUTONOMOUS';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: AIToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface AIToolParameterProperty {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
  default?: any;
}

export interface AIToolParameters {
  type: 'object';
  properties: Record<string, AIToolParameterProperty>;
  required?: string[];
}

export interface AITool {
  name: string;
  description: string;
  parameters: AIToolParameters;
  dangerous?: boolean; // If true, requires explicit confirmation in assisted & autonomous mode
  requiresConfirmation?: (args: any, mode: AIPermissionMode) => boolean;
}

export interface AIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface AIToolResult {
  toolCallId: string;
  name: string;
  output: string;
  error?: string;
  diffProposal?: DiffProposal;
}

export interface StructuredEdit {
  startLine: number;
  startColumn?: number;
  endLine: number;
  endColumn?: number;
  replacement: string;
}

export interface DiffProposal {
  id: string;
  path: string;
  originalContent: string;
  proposedContent: string;
  edits: StructuredEdit[];
  status: 'pending' | 'accepted' | 'rejected';
  summary?: string;
}

export interface EditorSelectionContext {
  text: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}

export interface ActiveFileContext {
  id?: string;
  path: string;
  language?: string;
  content?: string;
  selection?: EditorSelectionContext | null;
}

export interface WorkspaceAIContext {
  user: {
    id: string;
    name: string;
    email?: string;
    role?: string;
  };
  project: {
    id: string;
    name: string;
    description?: string;
  };
  activeFile?: ActiveFileContext | null;
  openTabs?: string[];
  fileTree?: string;
  git?: {
    branch?: string;
    statusSummary?: string;
    recentDiff?: string;
  };
  diagnostics?: string;
  targetFiles?: { path: string; content?: string }[];
  projectMemory?: {
    framework?: string;
    language?: string;
    architecture_summary?: string;
    coding_conventions?: string;
  };
}

export interface AIModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  description: string;
  supportsTools: boolean;
  isDefault?: boolean;
}

export interface AIProviderCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: AITool[];
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
}

export interface AIStreamCallbacks {
  onToken?: (token: string) => void;
  onToolCall?: (toolCall: AIToolCall) => void;
  onError?: (error: Error) => void;
}

export interface AIProvider {
  id: string;
  name: string;
  getModels(): Promise<AIModelInfo[]>;
  complete(messages: AIMessage[], options?: AIProviderCompletionOptions): Promise<AIMessage>;
  stream(
    messages: AIMessage[],
    callbacks: AIStreamCallbacks,
    options?: AIProviderCompletionOptions
  ): Promise<AIMessage>;
}

// Agent Execution Stream Events
export type AgentStreamEvent =
  | { type: 'status'; message: string; step?: number }
  | { type: 'tool_start'; toolCallId: string; toolName: string; args: any }
  | { type: 'tool_finish'; toolCallId: string; toolName: string; output: string; error?: string }
  | { type: 'diff_proposal'; proposal: DiffProposal }
  | { type: 'permission_request'; id: string; action: string; description: string; details?: any }
  | { type: 'token'; token: string }
  | { type: 'iteration_complete'; step: number; totalSteps: number }
  | { type: 'done'; summary?: string; totalTokens?: number; toolCallsCount?: number }
  | { type: 'error'; message: string };

export interface AgentConversationItem {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  permission_mode: AIPermissionMode;
  created_at: string;
  updated_at: string;
}

export interface AgentMessageItem {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: AIToolCall[];
  tool_results?: AIToolResult[];
  metadata?: Record<string, any>;
  created_at: string;
}

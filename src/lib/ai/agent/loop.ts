import {
  AIMessage,
  AIToolCall,
  AgentStreamEvent,
  AIPermissionMode,
  WorkspaceAIContext,
  DiffProposal,
  AgentTask,
} from '../types';
import { AIConfig } from '../config';
import { providerRegistry } from '../provider';
import { defaultToolRegistry } from './tool-registry';
import { ToolExecutor } from './tool-executor';
import { PermissionEngine } from './permissions';
import { buildSystemPrompt } from '../prompts';
import { GroqProvider } from '../groq-provider';

export interface AgentLoopOptions {
  userMessage: string;
  history?: AIMessage[];
  context: WorkspaceAIContext;
  permissionMode?: AIPermissionMode;
  confirmedActionIds?: string[]; // IDs of user-approved confirmations
  onEvent: (event: AgentStreamEvent) => void;
  maxSteps?: number;
  apiKey?: string;
}

export interface AgentLoopResult {
  finalResponse: string;
  messages: AIMessage[];
  diffProposals: DiffProposal[];
  totalSteps: number;
  task: AgentTask;
}

export class AgentExecutionLoop {
  static async run(options: AgentLoopOptions): Promise<AgentLoopResult> {
    const {
      userMessage,
      history = [],
      context,
      permissionMode = AIConfig.defaultPermissionMode,
      confirmedActionIds = [],
      onEvent,
      maxSteps = AIConfig.maxAgentSteps,
      apiKey,
    } = options;

    const provider = apiKey ? new GroqProvider(apiKey) : providerRegistry.get();
    const systemPrompt = buildSystemPrompt(context);
    const tools = defaultToolRegistry.getAll();
    const diffProposals: DiffProposal[] = [];
    const confirmedSet = new Set(confirmedActionIds);

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const task: AgentTask = {
      id: taskId,
      user_id: context.user?.id || 'anonymous',
      project_id: context.project?.id || 'default',
      conversation_id: '',
      user_goal: userMessage,
      mode: permissionMode,
      intent_mode: context.intentMode || 'AGENT',
      status: 'PLANNING',
      current_step: 0,
      max_steps: maxSteps,
      plan: [],
      files_inspected: [],
      files_modified: [],
      commands_run: [],
      tool_calls: [],
      validation_results: [],
      started_at: new Date().toISOString(),
    };

    onEvent({
      type: 'task_state',
      task: { ...task },
    });

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    let stepCount = 0;
    let finalResponse = '';

    const READ_ONLY_TOOLS = new Set([
      'read_file',
      'search_files',
      'list_files',
      'get_file_tree',
      'get_open_tabs',
      'get_editor_state',
      'inspect_project',
      'inspect_package_json',
      'inspect_environment_safely',
      'inspect_collaboration_state',
      'inspect_project_members',
    ]);

    try {
      while (stepCount < maxSteps) {
        stepCount++;
        const stepStartTime = Date.now();
        task.current_step = stepCount;
        task.status = 'RUNNING';

        onEvent({
          type: 'task_state',
          task: { ...task },
        });

        let currentTokenStream = '';
        let assistantMessage: AIMessage;

        // Context compaction: Prune older historic tool outputs and bound recent tool outputs
        // This keeps input prompt under ~700 tokens so Groq TTFT is sub-150ms and avoids 429 TPM limits
        const streamMessages: AIMessage[] = messages.map((m, idx) => {
          if (m.role === 'tool') {
            const raw = m.content || '';
            if (idx < messages.length - 2 && raw.length > 200) {
              return {
                ...m,
                content:
                  raw.slice(0, 150) +
                  `\n... [Output truncated (${raw.length - 150} chars) for high-velocity execution]`,
              };
            }
            if (raw.length > 1500) {
              return {
                ...m,
                content:
                  raw.slice(0, 1400) +
                  `\n... [Output truncated (${raw.length - 1400} chars) for high-velocity execution]`,
              };
            }
          }
          return m;
        });

        try {
          assistantMessage = await provider.stream(
            streamMessages,
            {
              onToken: (token) => {
                currentTokenStream += token;
                onEvent({ type: 'token', token });
              },
            },
            {
              tools,
              temperature: 0.1,
              maxTokens: Math.min(AIConfig.maxOutputTokens, 800),
            }
          );
        } catch (err: any) {
          task.status = 'FAILED';
          task.completed_at = new Date().toISOString();
          onEvent({
            type: 'task_state',
            task: { ...task },
          });
          onEvent({
            type: 'error',
            message: `AI completion failed: ${err.message}`,
          });
          throw err;
        }

        // Add assistant response to history
        messages.push(assistantMessage);

        // Check if model called any tools
        const toolCalls = assistantMessage.tool_calls;
        if (!toolCalls || toolCalls.length === 0) {
          // No more tool calls — agent finished
          finalResponse = assistantMessage.content || currentTokenStream || '';
          task.status = 'COMPLETED';
          task.completed_at = new Date().toISOString();

          onEvent({
            type: 'task_state',
            task: { ...task },
          });

          onEvent({
            type: 'done',
            summary: 'Agent task complete.',
            toolCallsCount: stepCount - 1,
          });
          break;
        }

        // Helper to execute a single tool call
        const executeSingleTool = async (toolCall: AIToolCall): Promise<{ toolCallId: string; content: string }> => {
          const toolName = toolCall.function.name;
          let args: any = {};
          try {
            args = JSON.parse(toolCall.function.arguments || '{}');
          } catch (e) {
            args = {};
          }

          const toolDef = defaultToolRegistry.get(toolName);
          if (!toolDef) {
            const errMsg = `Tool "${toolName}" is not registered.`;
            task.tool_calls?.push({
              name: toolName,
              args,
              status: 'failed',
            });
            return { toolCallId: toolCall.id, content: errMsg };
          }

          // 1. Permission check
          const perm = PermissionEngine.check(toolDef, args, permissionMode);
          if (!perm.allowed) {
            const denyMsg = perm.reason || `Action "${toolName}" is denied in ${permissionMode} mode.`;
            task.tool_calls?.push({
              name: toolName,
              args,
              status: 'failed',
            });
            onEvent({
              type: 'status',
              message: `Blocked: ${denyMsg}`,
              step: stepCount,
            });
            return { toolCallId: toolCall.id, content: `PERMISSION_DENIED: ${denyMsg}` };
          }

          // 2. Confirmation check for destructive or assisted operations
          const actionId = `action_${toolCall.id}`;
          if (perm.requiresConfirmation && !confirmedSet.has(actionId)) {
            task.status = 'WAITING_FOR_APPROVAL';
            onEvent({
              type: 'task_state',
              task: { ...task },
            });

            onEvent({
              type: 'permission_request',
              id: actionId,
              action: toolName,
              description: perm.reason || `Permission required to execute ${toolName}`,
              details: args,
            });

            return {
              toolCallId: toolCall.id,
              content: `CONFIRMATION_REQUIRED: Awaiting user confirmation for "${toolName}". The user has been prompted with the action details.`,
            };
          }

          // 3. Execution
          onEvent({
            type: 'tool_start',
            toolCallId: toolCall.id,
            toolName,
            args,
          });

          onEvent({
            type: 'status',
            message: `Executing ${toolName}...`,
            step: stepCount,
          });

          // Track files inspected / modified
          if (args.path) {
            if (['read_file', 'search_files', 'list_files', 'get_file_tree'].includes(toolName)) {
              if (!task.files_inspected?.includes(args.path)) task.files_inspected?.push(args.path);
            }
            if (['write_file', 'create_file', 'edit_file', 'apply_editor_edit'].includes(toolName)) {
              if (!task.files_modified?.includes(args.path)) task.files_modified?.push(args.path);
            }
          }

          if (toolName === 'run_terminal') {
            const cmd = args.command || '';
            if (cmd && !task.commands_run?.includes(cmd)) task.commands_run?.push(cmd);
          } else if (['run_typecheck', 'run_build', 'run_tests'].includes(toolName)) {
            task.status = 'VALIDATING';
            task.commands_run?.push(toolName);
          }

          const toolResult = await ToolExecutor.execute(
            context.project.id,
            toolName,
            args,
            context,
            (proposal) => {
              diffProposals.push(proposal);
              onEvent({ type: 'diff_proposal', proposal });
            }
          );

          // Track validation results
          if (['run_typecheck', 'run_build', 'run_tests'].includes(toolName)) {
            task.validation_results?.push({
              type: toolName,
              passed: !toolResult.error,
              output: toolResult.output.slice(0, 1000),
            });
          }

          task.tool_calls?.push({
            name: toolName,
            args,
            status: toolResult.error ? 'failed' : 'success',
          });

          onEvent({
            type: 'task_state',
            task: { ...task },
          });

          onEvent({
            type: 'tool_finish',
            toolCallId: toolCall.id,
            toolName,
            output: toolResult.output,
            error: toolResult.error,
          });

          return { toolCallId: toolCall.id, content: toolResult.output };
        };

        // Parallelize independent read-only tool calls for ultra-high velocity
        const isAllReadOnly = toolCalls.every((tc) => READ_ONLY_TOOLS.has(tc.function.name));
        if (isAllReadOnly && toolCalls.length > 1) {
          onEvent({
            type: 'status',
            message: `Running ${toolCalls.length} tool inspections in parallel...`,
            step: stepCount,
          });
          const results = await Promise.all(toolCalls.map((tc) => executeSingleTool(tc)));
          for (const res of results) {
            messages.push({
              role: 'tool',
              tool_call_id: res.toolCallId,
              content: res.content,
            });
          }
        } else {
          // Sequential execution for mutations or single tools
          for (const toolCall of toolCalls) {
            const res = await executeSingleTool(toolCall);
            messages.push({
              role: 'tool',
              tool_call_id: res.toolCallId,
              content: res.content,
            });
          }
        }

        const stepDurationMs = Date.now() - stepStartTime;
        onEvent({
          type: 'iteration_complete',
          step: stepCount,
          totalSteps: maxSteps,
        });
      }

      if (task.status !== 'COMPLETED' && stepCount >= maxSteps) {
        task.status = 'MAX_STEPS_REACHED';
        task.completed_at = new Date().toISOString();

        onEvent({
          type: 'task_state',
          task: { ...task },
        });

        onEvent({
          type: 'status',
          message: `Reached configured execution limit of ${maxSteps} agent steps. Stopping gracefully.`,
          step: stepCount,
        });
        onEvent({
          type: 'done',
          summary: `Zodiac reached the configured execution limit (${maxSteps} steps) before completing the task.`,
          toolCallsCount: stepCount,
        });
      }

      return {
        finalResponse,
        messages,
        diffProposals,
        totalSteps: stepCount,
        task,
      };
    } catch (err: any) {
      task.status = 'FAILED';
      task.completed_at = new Date().toISOString();
      onEvent({
        type: 'task_state',
        task: { ...task },
      });
      throw err;
    }
  }
}

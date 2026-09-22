import {
  AIMessage,
  AIToolCall,
  AgentStreamEvent,
  AIPermissionMode,
  WorkspaceAIContext,
  DiffProposal,
} from '../types';
import { AIConfig } from '../config';
import { providerRegistry } from '../provider';
import { defaultToolRegistry } from './tool-registry';
import { ToolExecutor } from './tool-executor';
import { PermissionEngine } from './permissions';
import { buildSystemPrompt } from '../prompts';

export interface AgentLoopOptions {
  userMessage: string;
  history?: AIMessage[];
  context: WorkspaceAIContext;
  permissionMode?: AIPermissionMode;
  confirmedActionIds?: string[]; // IDs of user-approved confirmations
  onEvent: (event: AgentStreamEvent) => void;
  maxSteps?: number;
}

export interface AgentLoopResult {
  finalResponse: string;
  messages: AIMessage[];
  diffProposals: DiffProposal[];
  totalSteps: number;
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
    } = options;

    const provider = providerRegistry.get();
    const systemPrompt = buildSystemPrompt(context);
    const tools = defaultToolRegistry.getAll();
    const diffProposals: DiffProposal[] = [];
    const confirmedSet = new Set(confirmedActionIds);

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    let stepCount = 0;
    let finalResponse = '';

    onEvent({
      type: 'status',
      message: 'Analyzing workspace context and request...',
      step: stepCount,
    });

    while (stepCount < maxSteps) {
      stepCount++;

      let currentTokenStream = '';
      let assistantMessage: AIMessage;

      try {
        assistantMessage = await provider.stream(
          messages,
          {
            onToken: (token) => {
              currentTokenStream += token;
              onEvent({ type: 'token', token });
            },
          },
          {
            tools,
            temperature: 0.2,
          }
        );
      } catch (err: any) {
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
        onEvent({
          type: 'done',
          summary: 'Agent task complete.',
          toolCallsCount: stepCount - 1,
        });
        break;
      }

      // Process tool calls sequentially
      for (const toolCall of toolCalls) {
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
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: errMsg,
          });
          continue;
        }

        // 1. Permission check
        const perm = PermissionEngine.check(toolDef, args, permissionMode);

        if (!perm.allowed) {
          const denyMsg = perm.reason || `Action "${toolName}" is denied in ${permissionMode} mode.`;
          onEvent({
            type: 'status',
            message: `Blocked: ${denyMsg}`,
            step: stepCount,
          });
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `PERMISSION_DENIED: ${denyMsg}`,
          });
          continue;
        }

        // 2. Confirmation check for destructive or assisted operations
        const actionId = `action_${toolCall.id}`;
        if (perm.requiresConfirmation && !confirmedSet.has(actionId)) {
          onEvent({
            type: 'permission_request',
            id: actionId,
            action: toolName,
            description: perm.reason || `Permission required to execute ${toolName}`,
            details: args,
          });

          // Inform the model that confirmation was requested from user
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `CONFIRMATION_REQUIRED: Awaiting user confirmation for "${toolName}". The user has been prompted with the action details.`,
          });
          continue;
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

        onEvent({
          type: 'tool_finish',
          toolCallId: toolCall.id,
          toolName,
          output: toolResult.output,
          error: toolResult.error,
        });

        // Feed tool result back to the model for next iteration
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult.output,
        });
      }

      onEvent({
        type: 'iteration_complete',
        step: stepCount,
        totalSteps: maxSteps,
      });
    }

    if (stepCount >= maxSteps) {
      onEvent({
        type: 'status',
        message: `Reached maximum limit of ${maxSteps} agent steps. Stopping iteration.`,
        step: stepCount,
      });
      onEvent({
        type: 'done',
        summary: `Reached max agent step limit (${maxSteps}).`,
        toolCallsCount: stepCount,
      });
    }

    return {
      finalResponse,
      messages,
      diffProposals,
      totalSteps: stepCount,
    };
  }
}

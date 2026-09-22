import Groq from 'groq-sdk';
import {
  AIProvider,
  AIModelInfo,
  AIMessage,
  AITool,
  AIToolCall,
  AIProviderCompletionOptions,
  AIStreamCallbacks,
} from './types';
import { AIConfig } from './config';

export class GroqProvider implements AIProvider {
  id = 'groq';
  name = 'Groq Cloud';

  private client: Groq | null = null;

  private getClient(): Groq {
    const apiKey = AIConfig.groqApiKey;
    if (!apiKey) {
      throw new Error(
        'Groq API key is not configured on the server. Please set GROQ_API_KEY in the server environment variables.'
      );
    }
    if (!this.client) {
      this.client = new Groq({ apiKey });
    }
    return this.client;
  }

  async getModels(): Promise<AIModelInfo[]> {
    return [
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B Versatile',
        contextWindow: 128000,
        maxOutputTokens: 8192,
        description: 'Flagship multilingual coding and reasoning model with full tool calling support.',
        supportsTools: true,
        isDefault: true,
      },
      {
        id: 'llama-3.1-70b-versatile',
        name: 'Llama 3.1 70B Versatile',
        contextWindow: 128000,
        maxOutputTokens: 8192,
        description: 'Powerful coding model with strong reasoning capabilities.',
        supportsTools: true,
      },
      {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant',
        contextWindow: 128000,
        maxOutputTokens: 8192,
        description: 'Ultra-fast lightweight model for quick edits and completions.',
        supportsTools: true,
      },
      {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B 32k',
        contextWindow: 32768,
        maxOutputTokens: 8192,
        description: 'High-speed MoE model for general code comprehension.',
        supportsTools: true,
      },
    ];
  }

  private mapMessages(messages: AIMessage[]): any[] {
    return messages.map((m) => {
      const base: any = { role: m.role };
      if (m.content !== undefined) {
        base.content = m.content || '';
      }
      if (m.role === 'tool') {
        base.tool_call_id = m.tool_call_id || '';
        base.content = m.content || '';
      }
      if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
        base.tool_calls = m.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));
      }
      return base;
    });
  }

  private mapTools(tools?: AITool[]): any[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  async complete(messages: AIMessage[], options?: AIProviderCompletionOptions): Promise<AIMessage> {
    const groq = this.getClient();
    const model = options?.model || AIConfig.defaultModel;
    const tools = this.mapTools(options?.tools);

    const payload: any = {
      model,
      messages: this.mapMessages(messages),
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? AIConfig.maxOutputTokens,
    };

    if (tools && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = options?.toolChoice || 'auto';
    }

    const response = await groq.chat.completions.create(payload);
    const choice = response.choices[0];
    if (!choice || !choice.message) {
      throw new Error('Received empty response from Groq');
    }

    const resMessage = choice.message;
    const result: AIMessage = {
      role: 'assistant',
      content: resMessage.content || '',
    };

    if (resMessage.tool_calls && resMessage.tool_calls.length > 0) {
      result.tool_calls = resMessage.tool_calls.map((tc: any) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));
    }

    return result;
  }

  async stream(
    messages: AIMessage[],
    callbacks: AIStreamCallbacks,
    options?: AIProviderCompletionOptions
  ): Promise<AIMessage> {
    const groq = this.getClient();
    const model = options?.model || AIConfig.defaultModel;
    const tools = this.mapTools(options?.tools);

    const payload: any = {
      model,
      messages: this.mapMessages(messages),
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? AIConfig.maxOutputTokens,
      stream: true,
    };

    if (tools && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = options?.toolChoice || 'auto';
    }

    let fullContent = '';
    const toolCallAccumulators: Map<number, { id: string; name: string; arguments: string }> = new Map();

    try {
      const stream = await groq.chat.completions.create(payload);

      for await (const chunk of stream as any) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        // 1. Text token
        if (delta.content) {
          fullContent += delta.content;
          if (callbacks.onToken) {
            callbacks.onToken(delta.content);
          }
        }

        // 2. Tool call delta
        if (delta.tool_calls) {
          for (const tcDelta of delta.tool_calls) {
            const index = tcDelta.index ?? 0;
            if (!toolCallAccumulators.has(index)) {
              toolCallAccumulators.set(index, {
                id: tcDelta.id || `call_${Date.now()}_${index}`,
                name: tcDelta.function?.name || '',
                arguments: '',
              });
            }
            const acc = toolCallAccumulators.get(index)!;
            if (tcDelta.id) acc.id = tcDelta.id;
            if (tcDelta.function?.name) acc.name += tcDelta.function.name;
            if (tcDelta.function?.arguments) acc.arguments += tcDelta.function.arguments;
          }
        }
      }

      // Convert accumulated tool calls
      const parsedToolCalls: AIToolCall[] = [];
      toolCallAccumulators.forEach((acc) => {
        const tc: AIToolCall = {
          id: acc.id,
          type: 'function',
          function: {
            name: acc.name,
            arguments: acc.arguments,
          },
        };
        parsedToolCalls.push(tc);
        if (callbacks.onToolCall) {
          callbacks.onToolCall(tc);
        }
      });

      return {
        role: 'assistant',
        content: fullContent,
        tool_calls: parsedToolCalls.length > 0 ? parsedToolCalls : undefined,
      };
    } catch (err: any) {
      if (callbacks.onError) {
        callbacks.onError(err);
      }
      throw err;
    }
  }
}

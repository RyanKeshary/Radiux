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
  private customApiKey?: string;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.customApiKey = apiKey;
    }
  }

  private getClient(): Groq {
    const apiKey = this.customApiKey || AIConfig.groqApiKey;
    if (!apiKey) {
      throw new Error(
        'Groq API key is not configured on the server. Please set GROQ_API_KEY in the server environment variables or configure it in Zodiac settings.'
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
        id: 'openai/gpt-oss-120b',
        name: 'OpenAI GPT-OSS 120B',
        contextWindow: 131072,
        maxOutputTokens: 65536,
        description: 'Flagship 120B reasoning model on Groq Cloud. Highest context (128K) and deep coding intelligence.',
        supportsTools: true,
        isDefault: true,
      },
      {
        id: 'qwen/qwen3.8-27b',
        name: 'Qwen 3.8 27B',
        contextWindow: 131072,
        maxOutputTokens: 8192,
        description: 'High-speed coding and tool-calling model on Groq Cloud.',
        supportsTools: true,
      },
      {
        id: 'openai/gpt-oss-20b',
        name: 'OpenAI GPT-OSS 20B',
        contextWindow: 131072,
        maxOutputTokens: 8192,
        description: 'Ultra-fast lightweight reasoning model on Groq Cloud.',
        supportsTools: true,
      },
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B Versatile',
        contextWindow: 131072,
        maxOutputTokens: 32768,
        description: 'Meta Llama 3.3 70B multilingual coding and reasoning model.',
        supportsTools: true,
      },
      {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant',
        contextWindow: 131072,
        maxOutputTokens: 8192,
        description: 'Ultra-fast lightweight model for instant answers.',
        supportsTools: true,
      },
    ];
  }

  private mapMessages(messages: AIMessage[]): any[] {
    return messages.map((m) => {
      const base: any = { role: m.role };
      if (m.role === 'tool') {
        base.tool_call_id = m.tool_call_id || '';
        base.content = m.content || '';
        return base;
      }

      if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
        // OpenAI / Groq standard: when assistant sends tool_calls, content must be null if empty string
        base.content = m.content ? m.content : null;
        base.tool_calls = m.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments:
              typeof tc.function.arguments === 'string'
                ? tc.function.arguments
                : JSON.stringify(tc.function.arguments || {}),
          },
        }));
        return base;
      }

      base.content = m.content !== undefined ? (m.content || '') : '';
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

  private async handleGroqError(err: any, payload: any, isStream: boolean): Promise<any> {
    const groq = this.getClient();
    // Intelligent fallback matrix based on active model
    const fallbackMatrix: Record<string, string> = {
      'openai/gpt-oss-120b': 'openai/gpt-oss-20b',
      'openai/gpt-oss-20b': 'qwen/qwen3.8-27b',
      'qwen/qwen3.8-27b': 'openai/gpt-oss-120b',
      'llama-3.3-70b-versatile': 'llama-3.1-8b-instant',
      'llama-3.1-8b-instant': 'openai/gpt-oss-120b',
    };
    const nextFallback = fallbackMatrix[payload.model] || 'openai/gpt-oss-20b';

    // 1. Rate Limit 429 handling (TPD vs TPM)
    if (err.status === 429 || err.message?.includes('rate_limit_exceeded') || err.message?.includes('Rate limit')) {
      const match = err.message?.match(/try again in ([\d\.]+)s/i);
      const waitSec = match ? parseFloat(match[1]) : 0;

      if (waitSec > 0 && waitSec <= 5) {
        console.warn(`[GroqProvider] TPM rate limit on ${payload.model}. Backing off ${waitSec.toFixed(1)}s...`);
        await new Promise((r) => setTimeout(r, Math.ceil(waitSec * 1000) + 300));
        return isStream
          ? groq.chat.completions.create({ ...payload, stream: true })
          : groq.chat.completions.create(payload);
      }

      if (payload.model !== nextFallback) {
        console.warn(`[GroqProvider] Rate limit on ${payload.model}. Switching to ${nextFallback}...`);
        payload.model = nextFallback;
        return isStream
          ? groq.chat.completions.create({ ...payload, stream: true })
          : groq.chat.completions.create(payload);
      }
    }

    // 2. Model Not Found / Tool Use Error 404 / 400
    if (
      err.status === 404 ||
      err.status === 400 ||
      err.message?.includes('does not exist') ||
      err.message?.includes('Failed to call a function')
    ) {
      if (payload.model !== nextFallback) {
        console.warn(`[GroqProvider] Model ${payload.model} failed (${err.message}). Falling back to ${nextFallback}...`);
        payload.model = nextFallback;
        return isStream
          ? groq.chat.completions.create({ ...payload, stream: true })
          : groq.chat.completions.create(payload);
      }
    }

    throw err;
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

    let response: any;
    try {
      response = await groq.chat.completions.create(payload);
    } catch (err: any) {
      response = await this.handleGroqError(err, payload, false);
    }
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

    let assistantContent = '';
    let reasoningText = '';
    const toolCallAccumulators: Map<number, { id: string; name: string; arguments: string }> = new Map();

    try {
      let stream: any;
      try {
        stream = await groq.chat.completions.create(payload);
      } catch (err: any) {
        stream = await this.handleGroqError(err, payload, true);
      }

      for await (const chunk of stream as any) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        // 1. User-visible text token
        if (delta.content) {
          assistantContent += delta.content;
          if (callbacks.onToken) {
            callbacks.onToken(delta.content);
          }
        } else if (delta.reasoning || delta.reasoning_content) {
          // Internal reasoning scratchpad - keep separate from assistant message content
          const reasoning = delta.reasoning || delta.reasoning_content;
          reasoningText += reasoning;
        }

        // 2. Tool call delta (supports parallel & multi-function calling)
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
            if (tcDelta.function?.name) {
              if (!acc.name) {
                acc.name = tcDelta.function.name;
              } else if (!acc.name.includes(tcDelta.function.name)) {
                acc.name += tcDelta.function.name;
              }
            }
            if (tcDelta.function?.arguments) {
              acc.arguments += tcDelta.function.arguments;
            }
          }
        }
      }

      // Convert accumulated tool calls in sorted index order
      const parsedToolCalls: AIToolCall[] = [];
      const sortedEntries = Array.from(toolCallAccumulators.entries()).sort(([a], [b]) => a - b);
      for (const [, acc] of sortedEntries) {
        if (!acc.name) continue;
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
      }

      // If tools were called, content should be empty string or text if generated
      const finalContent = parsedToolCalls.length > 0
        ? ''
        : (assistantContent || reasoningText);

      return {
        role: 'assistant',
        content: finalContent,
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

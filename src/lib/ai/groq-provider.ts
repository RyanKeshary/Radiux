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
        id: 'openai/gpt-oss-20b',
        name: 'GPT OSS 20B',
        contextWindow: 128000,
        maxOutputTokens: 8192,
        description: 'Ultra-fast lightweight reasoning model on Groq Cloud.',
        supportsTools: true,
        isDefault: true,
      },
      {
        id: 'qwen/qwen3.8-27b',
        name: 'Qwen 3.8 27B',
        contextWindow: 128000,
        maxOutputTokens: 8192,
        description: 'Verified high-speed coding and tool-calling model on Groq Cloud.',
        supportsTools: true,
      },
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B Versatile',
        contextWindow: 128000,
        maxOutputTokens: 8192,
        description: 'Multilingual coding and reasoning model.',
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

  private async handleGroqError(err: any, payload: any, isStream: boolean): Promise<any> {
    const groq = this.getClient();
    // 1. Rate Limit 429 handling (TPD vs TPM)
    if (err.status === 429 || err.message?.includes('rate_limit_exceeded') || err.message?.includes('Rate limit')) {
      // Check for wait duration in message
      const match = err.message?.match(/try again in ([\d\.]+)s/i);
      const waitSec = match ? parseFloat(match[1]) : 0;

      // If wait is brief (<= 10s), back off and retry
      if (waitSec > 0 && waitSec <= 10) {
        console.warn(`[GroqProvider] TPM rate limit on ${payload.model}. Backing off ${waitSec.toFixed(1)}s...`);
        await new Promise((r) => setTimeout(r, Math.ceil(waitSec * 1000) + 300));
        payload.model = 'llama-3.3-70b-versatile';
        payload.max_tokens = Math.min(payload.max_tokens || 800, 600);
        return isStream
          ? groq.chat.completions.create({ ...payload, stream: true })
          : groq.chat.completions.create(payload);
      }

      // If not already on fallback, switch immediately
      if (payload.model !== 'llama-3.3-70b-versatile') {
        console.warn(`[GroqProvider] Rate limit on ${payload.model}. Switching to llama-3.3-70b-versatile...`);
        payload.model = 'llama-3.3-70b-versatile';
        payload.max_tokens = Math.min(payload.max_tokens || 800, 600);
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
      if (payload.model !== 'llama-3.3-70b-versatile') {
        console.warn(`[GroqProvider] Model ${payload.model} failed (${err.message}). Falling back to llama-3.3-70b-versatile...`);
        payload.model = 'llama-3.3-70b-versatile';
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

        // 2. Tool call delta
        if (delta.tool_calls) {
          for (const tcDelta of delta.tool_calls) {
            const index = tcDelta.index ?? 0;
            if (!toolCallAccumulators.has(index)) {
              // Initialize with the first chunk's name (Groq sends name only on first delta)
              toolCallAccumulators.set(index, {
                id: tcDelta.id || `call_${Date.now()}_${index}`,
                name: tcDelta.function?.name || '',
                arguments: '',
              });
            }
            const acc = toolCallAccumulators.get(index)!;
            if (tcDelta.id) acc.id = tcDelta.id;
            // Do NOT append name — Groq sends it only once on the first delta
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

      // If tools were called, content must remain clean (empty string) for strict API compatibility
      const finalContent = parsedToolCalls.length > 0
        ? assistantContent
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

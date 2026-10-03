import { AIPermissionMode } from './types';

/**
 * Server-Side AI Configuration
 * 
 * CRITICAL SECURITY INVARIANT:
 * GROQ_API_KEY must strictly remain server-side.
 * Never prefix with NEXT_PUBLIC_ and never send to browser bundles or logs.
 */

export const AIConfig = {
  // Provider API Key (Server-only)
  get groqApiKey(): string {
    return process.env.GROQ_API_KEY || '';
  },

  // Configured default model (Groq flagship reasoning & tool capable with 128K context)
  // openai/gpt-oss-120b: flagship 120B model on Groq Cloud with highest token limit (131,072)
  get defaultModel(): string {
    return process.env.AI_MODEL || 'openai/gpt-oss-120b';
  },

  // Maximum iterative tool steps per agent execution
  get maxAgentSteps(): number {
    const val = parseInt(process.env.AI_MAX_STEPS || '15', 10);
    return isNaN(val) || val <= 0 ? 15 : Math.min(val, 30);
  },

  // Token limits
  get maxContextTokens(): number {
    const val = parseInt(process.env.AI_MAX_CONTEXT || '131072', 10);
    return isNaN(val) || val <= 0 ? 131072 : val;
  },

  get maxOutputTokens(): number {
    const val = parseInt(process.env.AI_MAX_OUTPUT || '8192', 10);
    return isNaN(val) || val <= 0 ? 8192 : Math.min(val, 65536);
  },

  // Default security permission mode
  get defaultPermissionMode(): AIPermissionMode {
    const mode = process.env.AI_DEFAULT_PERMISSION_MODE;
    if (mode === 'READ_ONLY' || mode === 'AUTONOMOUS') {
      return mode;
    }
    return 'ASSISTED';
  },

  // Maximum file size in bytes to read into context (1MB)
  maxFileSizeBytes: 1024 * 1024,

  // Maximum search results
  maxSearchResults: 30,

  // Maximum terminal execution duration in ms
  terminalTimeoutMs: 30000,

  // Sanitize text to avoid accidental secret leakage to LLM
  sanitizeText(text: string): string {
    if (!text) return '';
    return text
      .replace(/ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, '[REDACTED_JWT]')
      .replace(/(gsk_[A-Za-z0-9]{32,})/g, '[REDACTED_GROQ_KEY]')
      .replace(/(sk-[A-Za-z0-9]{32,})/g, '[REDACTED_API_KEY]')
      .replace(/(SUPABASE_SERVICE_ROLE_KEY=)[^\s\n]+/gi, '$1[REDACTED]')
      .replace(/(DATABASE_URL=)[^\s\n]+/gi, '$1[REDACTED]');
  },
};

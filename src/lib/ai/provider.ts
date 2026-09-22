import { AIProvider, AIModelInfo } from './types';
import { GroqProvider } from './groq-provider';

/**
 * Provider Registry
 * Allows multi-provider extensibility (Groq currently; OpenAI, Anthropic, Gemini in the future)
 */
class AIProviderRegistry {
  private providers: Map<string, AIProvider> = new Map();
  private defaultProviderId: string = 'groq';

  constructor() {
    // Register official Groq provider
    this.register(new GroqProvider());
  }

  register(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id?: string): AIProvider {
    const targetId = id || this.defaultProviderId;
    const provider = this.providers.get(targetId);
    if (!provider) {
      throw new Error(`AI Provider "${targetId}" is not registered or supported.`);
    }
    return provider;
  }

  async getAllModels(): Promise<{ providerId: string; models: AIModelInfo[] }[]> {
    const results: { providerId: string; models: AIModelInfo[] }[] = [];
    const entries = Array.from(this.providers.entries());
    for (let i = 0; i < entries.length; i++) {
      const [providerId, provider] = entries[i];
      try {
        const models = await provider.getModels();
        results.push({ providerId, models });
      } catch (err) {
        console.warn(`[AIProviderRegistry] Failed to fetch models for ${providerId}:`, err);
      }
    }
    return results;
  }
}

export const providerRegistry = new AIProviderRegistry();

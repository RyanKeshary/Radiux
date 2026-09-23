import { NextRequest, NextResponse } from 'next/server';
import { providerRegistry } from '@/lib/ai/provider';
import { GroqProvider } from '@/lib/ai/groq-provider';
import { buildInlineAIPrompt } from '@/lib/ai/prompts';
import { AIConfig } from '@/lib/ai/config';

export async function POST(req: NextRequest) {
  try {
    const clientProvidedKey = (req.headers.get('x-groq-api-key') || '').trim();
    const effectiveApiKey = clientProvidedKey || AIConfig.groqApiKey;

    if (!effectiveApiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY is not configured on the server. Please configure your Groq API key in Zodiac settings.' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { filePath, language, selectedCode, userInstruction } = body;

    if (!selectedCode || !userInstruction) {
      return NextResponse.json(
        { error: 'Missing selectedCode or userInstruction.' },
        { status: 400 }
      );
    }

    const prompt = buildInlineAIPrompt(
      filePath || 'untitled',
      language || 'plaintext',
      selectedCode,
      userInstruction
    );

    const provider = clientProvidedKey ? new GroqProvider(clientProvidedKey) : providerRegistry.get();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          await provider.stream(
            [{ role: 'user', content: prompt }],
            {
              onToken: (token) => {
                controller.enqueue(encoder.encode(token));
              },
            },
            {
              temperature: 0.2,
              maxTokens: 4096,
            }
          );
          controller.close();
        } catch (err: any) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

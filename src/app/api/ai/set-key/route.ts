import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { AIConfig } from '@/lib/ai/config';

export async function GET() {
  const currentKey = process.env.GROQ_API_KEY || '';
  const isConfigured = !!currentKey && currentKey.trim().length > 5;
  const maskedKey = isConfigured
    ? `${currentKey.slice(0, 4)}...${currentKey.slice(-4)}`
    : undefined;

  return NextResponse.json({
    configured: isConfigured,
    model: AIConfig.defaultModel,
    maskedKey,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawKey = (body.apiKey || '').trim();

    if (!rawKey) {
      return NextResponse.json(
        { error: 'API key cannot be empty.' },
        { status: 400 }
      );
    }

    // Set in runtime memory
    process.env.GROQ_API_KEY = rawKey;

    // Persist to .env.local if running in local environment
    try {
      const envLocalPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envLocalPath)) {
        let content = fs.readFileSync(envLocalPath, 'utf8');
        if (/^GROQ_API_KEY=.*$/m.test(content)) {
          content = content.replace(/^GROQ_API_KEY=.*$/m, `GROQ_API_KEY=${rawKey}`);
        } else {
          content += `\nGROQ_API_KEY=${rawKey}\n`;
        }
        fs.writeFileSync(envLocalPath, content, 'utf8');
      }
    } catch (fsErr) {
      console.warn('[AI Set-Key] Unable to write to .env.local:', fsErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Groq API Key configured successfully.',
      configured: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to configure API key.' },
      { status: 500 }
    );
  }
}

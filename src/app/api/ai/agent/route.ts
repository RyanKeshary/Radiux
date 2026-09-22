import { NextRequest, NextResponse } from 'next/server';
import { AgentExecutionLoop } from '@/lib/ai/agent/loop';
import { WorkspaceAIContext, AIPermissionMode, AIMessage, AgentStreamEvent } from '@/lib/ai/types';
import { AIConfig } from '@/lib/ai/config';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client for authentication and usage logging
function getSupabaseServerClient(authHeader?: string | null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let userMessage = '';
  let projectId = 'default';
  let userId = 'anonymous';

  try {
    const authHeader = req.headers.get('Authorization');
    const supabase = getSupabaseServerClient(authHeader);

    // 1. Verify User Authentication
    if (supabase && authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (!authErr && user) {
        userId = user.id;
      }
    }

    const body = await req.json();
    userMessage = body.userMessage || '';
    const conversationId: string | undefined = body.conversationId;
    const clientContext: Partial<WorkspaceAIContext> = body.context || {};
    const permissionMode: AIPermissionMode = body.permissionMode || AIConfig.defaultPermissionMode;
    const confirmedActionIds: string[] = body.confirmedActionIds || [];
    const history: AIMessage[] = body.history || [];

    projectId = clientContext.project?.id || 'default';

    if (!userMessage.trim()) {
      return NextResponse.json({ error: 'Missing userMessage in request.' }, { status: 400 });
    }

    // 2. Validate Groq API Key is configured on server
    if (!AIConfig.groqApiKey) {
      return NextResponse.json(
        {
          error:
            'GROQ_API_KEY is not configured in the server environment. Please configure your Groq API key in your server deployment settings.',
        },
        { status: 503 }
      );
    }

    // 3. Setup ReadableStream for Server-Sent Events (SSE)
    const encoder = new TextEncoder();
    let totalTokens = 0;
    let toolCallsCount = 0;
    let finalAssistantText = '';

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: AgentStreamEvent) => {
          try {
            const data = JSON.stringify(event);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          } catch (e) {}
        };

        try {
          const result = await AgentExecutionLoop.run({
            userMessage,
            history,
            context: clientContext as WorkspaceAIContext,
            permissionMode,
            confirmedActionIds,
            onEvent: (event) => {
              if (event.type === 'token') {
                totalTokens++;
              }
              if (event.type === 'tool_start') {
                toolCallsCount++;
              }
              sendEvent(event);
            },
          });

          finalAssistantText = result.finalResponse;

          // 4. Persistence to database if supabase is available and conversation exists
          if (supabase && conversationId && conversationId !== 'new') {
            try {
              // Save user message
              await supabase.from('ai_messages').insert({
                conversation_id: conversationId,
                role: 'user',
                content: userMessage,
              });

              // Save assistant message
              await supabase.from('ai_messages').insert({
                conversation_id: conversationId,
                role: 'assistant',
                content: finalAssistantText,
              });

              // Touch conversation updated_at
              await supabase
                .from('ai_conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', conversationId);
            } catch (persistErr) {
              console.warn('[AI Agent API] Could not persist message to DB:', persistErr);
            }
          }

          // 5. Asynchronously log AI usage
          if (supabase) {
            const latency = Date.now() - startTime;
            try {
              await supabase.from('ai_usage').insert({
                user_id: userId !== 'anonymous' ? userId : null,
                project_id: projectId !== 'default' ? projectId : null,
                model: AIConfig.defaultModel,
                prompt_tokens: Math.round(userMessage.length / 4) + 100,
                completion_tokens: Math.round(finalAssistantText.length / 4),
                latency_ms: latency,
                tool_calls_count: toolCallsCount,
                status: 'success',
              });
            } catch (usageErr) {}
          }

          controller.close();
        } catch (runErr: any) {
          console.error('[AI Agent Execution Error]:', runErr);
          sendEvent({
            type: 'error',
            message: AIConfig.sanitizeText(runErr.message || 'Agent execution encountered an error.'),
          });

          // Log failed usage
          if (supabase) {
            try {
              await supabase.from('ai_usage').insert({
                user_id: userId !== 'anonymous' ? userId : null,
                project_id: projectId !== 'default' ? projectId : null,
                model: AIConfig.defaultModel,
                prompt_tokens: 0,
                completion_tokens: 0,
                latency_ms: Date.now() - startTime,
                tool_calls_count: toolCallsCount,
                status: 'error',
                error_message: runErr.message || 'Unknown error',
              });
            } catch (e) {}
          }

          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: any) {
    console.error('[POST /api/ai/agent] Internal Server Error:', err);
    return NextResponse.json(
      { error: AIConfig.sanitizeText(err.message || 'Internal server error') },
      { status: 500 }
    );
  }
}

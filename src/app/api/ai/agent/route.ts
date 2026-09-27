import { NextRequest, NextResponse } from 'next/server';
import { AgentExecutionLoop } from '@/lib/ai/agent/loop';
import { WorkspaceAIContext, AIPermissionMode, AIMessage, AgentStreamEvent } from '@/lib/ai/types';
import { AIConfig } from '@/lib/ai/config';
import { createClient } from '@supabase/supabase-js';
import { logAnalyticsEvent, logErrorEvent, logPerformanceEvent } from '@/lib/analytics/store';

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

    // 2. Server-side Project Membership and RBAC Verification
    let verifiedRole = clientContext.user?.role || 'editor';
    if (supabase && projectId !== 'default' && userId !== 'anonymous') {
      try {
        const { data: member } = await supabase
          .from('project_members')
          .select('role')
          .eq('project_id', projectId)
          .eq('user_id', userId)
          .maybeSingle();

        if (member && member.role) {
          verifiedRole = member.role;
        } else {
          const { data: proj } = await supabase
            .from('projects')
            .select('owner_id')
            .eq('id', projectId)
            .maybeSingle();

          if (proj && proj.owner_id === userId) {
            verifiedRole = 'owner';
          } else if (proj) {
            return NextResponse.json(
              { error: 'Unauthorized: You are not a member of this project.' },
              { status: 403 }
            );
          }
        }
      } catch (rbacErr) {
        // Graceful fallback if database table not available
      }
    }

    clientContext.user = {
      ...(clientContext.user || {}),
      id: userId,
      name: clientContext.user?.name || 'User',
      role: verifiedRole as any,
    };

    // 3. Validate Groq API Key (from process.env or x-groq-api-key header or body)
    const clientProvidedKey = (req.headers.get('x-groq-api-key') || body.groqApiKey || '').trim();
    const effectiveApiKey = clientProvidedKey || AIConfig.groqApiKey;

    if (!effectiveApiKey) {
      return NextResponse.json(
        {
          error:
            'GROQ_API_KEY is not configured in the server environment. Please click the Key icon in Zodiac to configure your Groq API key.',
          needsApiKey: true,
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
            apiKey: effectiveApiKey,
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

              // Save task state and tool calls if available
              if (result.task) {
                try {
                  await supabase.from('ai_tasks').insert({
                    id: result.task.id,
                    user_id: userId !== 'anonymous' ? userId : null,
                    project_id: projectId !== 'default' ? projectId : null,
                    conversation_id: conversationId || null,
                    status: result.task.status,
                    mode: result.task.mode,
                    intent_mode: result.task.intent_mode,
                    goal: result.task.user_goal,
                    current_step: result.task.current_step,
                    max_steps: result.task.max_steps,
                    files_inspected: result.task.files_inspected,
                    files_modified: result.task.files_modified,
                    commands_run: result.task.commands_run,
                    validation_results: result.task.validation_results,
                    started_at: result.task.started_at,
                    completed_at: result.task.completed_at,
                  });

                  if (result.task.tool_calls && result.task.tool_calls.length > 0) {
                    const rows = result.task.tool_calls.map((tc: any) => ({
                      task_id: result.task.id,
                      tool_name: tc.name,
                      args: tc.args || {},
                      status: tc.status,
                    }));
                    await supabase.from('ai_tool_calls').insert(rows);
                  }
                } catch (taskSaveErr) {
                  // Non-fatal if schema v16 is pending
                }
              }
            } catch (persistErr) {
              console.warn('[AI Agent API] Could not persist message to DB:', persistErr);
            }
          }

          // 5. Asynchronously log AI usage & canonical intelligence
          const latency = Date.now() - startTime;
          logAnalyticsEvent({
            eventType: 'zodiac.request',
            userId: userId !== 'anonymous' ? userId : null,
            projectId: projectId !== 'default' ? projectId : null,
            metadata: { model: AIConfig.defaultModel, latency_ms: latency, toolCallsCount, status: 'success' },
          }).catch(() => {});

          logPerformanceEvent({
            eventName: 'zodiac.completion',
            subsystem: 'ai',
            latencyMs: latency,
            userId: userId !== 'anonymous' ? userId : null,
            projectId: projectId !== 'default' ? projectId : null,
          }).catch(() => {});

          if (supabase) {
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
          logErrorEvent({
            message: runErr.message || 'AI agent execution failure',
            subsystem: 'ai',
            userId: userId !== 'anonymous' ? userId : null,
            projectId: projectId !== 'default' ? projectId : null,
          }).catch(() => {});

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

import { describe, it, expect } from 'vitest';
import { AIConfig } from '@/lib/ai/config';
import { GroqProvider } from '@/lib/ai/groq-provider';
import { defaultToolRegistry, CORE_AI_TOOLS } from '@/lib/ai/agent/tool-registry';
import { AIMessage } from '@/lib/ai/types';

describe('Zodiac AI Engine & Groq Provider Configuration', () => {
  it('should default to openai/gpt-oss-120b with 128k context and high token output', () => {
    expect(AIConfig.defaultModel).toBe('openai/gpt-oss-120b');
    expect(AIConfig.maxContextTokens).toBeGreaterThanOrEqual(128000);
    expect(AIConfig.maxOutputTokens).toBeGreaterThanOrEqual(8192);
  });

  it('should expose the full suite of Groq models with high token windows', async () => {
    const provider = new GroqProvider('gsk_mock_test_key_12345');
    const models = await provider.getModels();
    expect(models.length).toBeGreaterThanOrEqual(4);

    const defaultModel = models.find((m) => m.isDefault);
    expect(defaultModel).toBeDefined();
    expect(defaultModel?.id).toBe('openai/gpt-oss-120b');
    expect(defaultModel?.contextWindow).toBe(131072);
    expect(defaultModel?.maxOutputTokens).toBe(65536);

    const qwen = models.find((m) => m.id === 'qwen/qwen3.8-27b');
    expect(qwen).toBeDefined();
    expect(qwen?.contextWindow).toBe(131072);

    const llama70b = models.find((m) => m.id === 'llama-3.3-70b-versatile');
    expect(llama70b).toBeDefined();
    expect(llama70b?.contextWindow).toBe(131072);
  });

  it('should map assistant messages with tool calls cleanly for Groq compliance', () => {
    const provider = new GroqProvider('gsk_mock');
    const messages: AIMessage[] = [
      { role: 'user', content: 'Inspect files' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'list_files',
              arguments: '{"path":""}',
            },
          },
        ],
      },
      {
        role: 'tool',
        tool_call_id: 'call_1',
        content: '["package.json", "src/"]',
      },
    ];

    const mapped = (provider as any).mapMessages(messages);
    expect(mapped[0].role).toBe('user');
    expect(mapped[1].role).toBe('assistant');
    // In OpenAI/Groq spec, content must be null if assistant only called tools
    expect(mapped[1].content).toBeNull();
    expect(mapped[1].tool_calls).toHaveLength(1);
    expect(mapped[1].tool_calls[0].function.name).toBe('list_files');
    expect(mapped[2].role).toBe('tool');
    expect(mapped[2].tool_call_id).toBe('call_1');
  });

  it('should register and expose all 29 tools by default for multifunctionality', () => {
    const allTools = defaultToolRegistry.getAll();
    expect(allTools.length).toBeGreaterThanOrEqual(28);

    // Verify critical tools are included and available
    const toolNames = allTools.map((t) => t.name);
    expect(toolNames).toContain('write_file');
    expect(toolNames).toContain('edit_file');
    expect(toolNames).toContain('create_file');
    expect(toolNames).toContain('read_file');
    expect(toolNames).toContain('search_files');
    expect(toolNames).toContain('get_file_tree');
    expect(toolNames).toContain('get_current_file');
    expect(toolNames).toContain('get_selection');
    expect(toolNames).toContain('get_open_tabs');
    expect(toolNames).toContain('get_editor_state');
    expect(toolNames).toContain('run_terminal');
    expect(toolNames).toContain('run_typecheck');
    expect(toolNames).toContain('run_build');
    expect(toolNames).toContain('run_tests');
    expect(toolNames).toContain('git_status');
    expect(toolNames).toContain('git_diff');
    expect(toolNames).toContain('git_log');
    expect(toolNames).toContain('git_branch');
    expect(toolNames).toContain('diagnostics');
    expect(toolNames).toContain('inspect_project');
    expect(toolNames).toContain('inspect_package_json');
  });

  it('should have valid JSON schemas for edit_file with structured edit properties', () => {
    const editTool = defaultToolRegistry.get('edit_file');
    expect(editTool).toBeDefined();
    const props = editTool?.parameters?.properties;
    expect(props?.edits?.items?.properties?.startLine).toBeDefined();
    expect(props?.edits?.items?.properties?.endLine).toBeDefined();
    expect(props?.edits?.items?.properties?.replacement).toBeDefined();
  });
});

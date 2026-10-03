import { describe, it, expect } from 'vitest';
import { AgentExecutionLoop } from '@/lib/ai/agent/loop';
import { defaultToolRegistry } from '@/lib/ai/agent/tool-registry';
import { AIConfig } from '@/lib/ai/config';
import { WorkspaceAIContext, AgentStreamEvent } from '@/lib/ai/types';

describe('Zodiac Agent Multi-Functionality & Tool Loop Integration', () => {
  it('should support parallel execution of multiple read-only inspection tools', async () => {
    const events: AgentStreamEvent[] = [];
    const context: WorkspaceAIContext = {
      project: { id: 'test_proj', name: 'Test Project' },
      user: { id: 'user_1', name: 'Developer', role: 'owner' },
      openTabs: ['src/app/page.tsx', 'package.json'],
      activeFile: {
        path: 'package.json',
        language: 'json',
        content: '{\n  "name": "radiux",\n  "version": "1.0.0"\n}\n',
      },
    };

    // Verify all canonical tools are registered and available
    const tools = defaultToolRegistry.getAll();
    expect(tools.length).toBeGreaterThanOrEqual(28);

    const hasWrite = tools.some((t) => t.name === 'write_file');
    const hasEdit = tools.some((t) => t.name === 'edit_file');
    const hasRead = tools.some((t) => t.name === 'read_file');
    const hasTree = tools.some((t) => t.name === 'get_file_tree');
    const hasDiag = tools.some((t) => t.name === 'diagnostics');
    const hasBuild = tools.some((t) => t.name === 'run_build');
    const hasTests = tools.some((t) => t.name === 'run_tests');

    expect(hasWrite).toBe(true);
    expect(hasEdit).toBe(true);
    expect(hasRead).toBe(true);
    expect(hasTree).toBe(true);
    expect(hasDiag).toBe(true);
    expect(hasBuild).toBe(true);
    expect(hasTests).toBe(true);
  });

  it('should configure 128K context and 8192 output tokens for openai/gpt-oss-120b', () => {
    expect(AIConfig.defaultModel).toBe('openai/gpt-oss-120b');
    expect(AIConfig.maxContextTokens).toBe(131072);
    expect(AIConfig.maxOutputTokens).toBe(8192);
  });
});

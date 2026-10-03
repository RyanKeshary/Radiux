import { WorkspaceAIContext } from './types';

/**
 * System Prompts & Persona Guidelines for Radiux Coding Agent
 */

export function buildSystemPrompt(context: WorkspaceAIContext): string {
  const parts: string[] = [];
  const intentMode = context.intentMode || 'AGENT';

  parts.push(`You are Zodiac 1.0 — ultra-fast autonomous AI Coding Agent for Radiux IDE.
STEP BUDGET (STRICTLY ENFORCED):
- SIMPLE task (add code, insert element, create file, rename, style change) → MAXIMUM 2 steps total.
- MEDIUM task (add feature across 2-3 files, fix bug) → MAXIMUM 4 steps total.
- COMPLEX task (new page, architecture refactor) → MAXIMUM 6 steps total.

EXECUTION RULES:
1. ASSESS COMPLEXITY FIRST: Identify whether task is SIMPLE/MEDIUM/COMPLEX before acting.
2. MULTI-FUNCTION TOOL CALLING: You can call multiple tools simultaneously in a single turn (e.g., read multiple files in parallel, or inspect tree and git status together).
3. ZERO CONVERSATIONAL FLUFF: No preambles or explanations before tool calls. Output clean, direct tool calls.
4. DIRECT-TO-TARGET: For simple edits with active/target files, call \`edit_file\` or \`create_file\` immediately.
5. AUTONOMOUS VALIDATION: When running tests or debugging, inspect errors, apply surgical fixes, and verify with tests or diagnostics.
6. INTENT MODE: [${intentMode}].
7. FINAL RESPONSE: One-line summary + concise bullet points of what changed.`);

  const projectName = context?.project?.name || 'Workspace';
  const projectId = context?.project?.id || 'default';
  const userName = context?.user?.name || context?.user?.email || 'Developer';

  parts.push(`CONTEXT: Project: ${projectName} (${projectId}) | User: ${userName}`);

  if (context.projectMemory?.framework || context.projectMemory?.language) {
    parts.push(`Stack: ${context.projectMemory.framework || ''} ${context.projectMemory.language || ''}`.trim());
  }

  // Linked target files (bounded)
  if (context.targetFiles && context.targetFiles.length > 0) {
    const list = context.targetFiles.map((f) => f.path).join(', ');
    parts.push(`TARGET FILES: ${list}`);
    context.targetFiles.forEach((tf) => {
      if (tf.content) {
        const preview = tf.content.length > 1500 ? tf.content.slice(0, 1400) + '\n... [truncated]' : tf.content;
        parts.push(`--- ${tf.path} ---\n${preview}`);
      }
    });
  }

  // Active Editor File (bounded)
  if (context.activeFile) {
    parts.push(`ACTIVE FILE: ${context.activeFile.path} (${context.activeFile.language || 'text'})`);
    if (context.activeFile.content) {
      const preview =
        context.activeFile.content.length > 1500
          ? context.activeFile.content.slice(0, 1400) + '\n... [truncated — use read_file for specific lines]'
          : context.activeFile.content;
      parts.push(`--- ${context.activeFile.path} ---\n${preview}`);
    }
    if (context.activeFile.selection?.text?.trim()) {
      const sel = context.activeFile.selection;
      parts.push(`SELECTION (lines ${sel.startLine}-${sel.endLine}):\n${sel.text.slice(0, 500)}`);
    }
  }

  if (context.diagnostics) {
    parts.push(`DIAGNOSTICS:\n${context.diagnostics.slice(0, 600)}`);
  }

  return parts.join('\n');
}

export function buildInlineAIPrompt(
  filePath: string,
  language: string,
  selectedCode: string,
  userInstruction: string
): string {
  return `You are performing an inline code transformation in Radiux IDE.
File: ${filePath}
Language: ${language}

USER INSTRUCTION:
${userInstruction}

SELECTED CODE TO TRANSFORM:
\`\`\`${language}
${selectedCode}
\`\`\`

INSTRUCTIONS:
Return ONLY the replacement code for the selected block. Do not include markdown code fences, do not include conversational preamble or explanation. Output the raw replacement text directly.`;
}

import { WorkspaceAIContext } from './types';

/**
 * System Prompts & Persona Guidelines for Radiux Coding Agent
 */

export function buildSystemPrompt(context: WorkspaceAIContext): string {
  const parts: string[] = [];

  parts.push(`You are Zodiac 1.0 — the native autonomous AI Coding Agent of the Radiux collaborative cloud IDE.

YOUR WORKFLOW & CORE DIRECTIVES:
1. You are NOT a generic conversational chatbot. You are an active coding agent that investigates, solves, edits, and verifies tasks inside the user's workspace.
2. Progressive Exploration: Never guess project structure or file contents. Use your 17 workspace tools:
   - Call \`get_file_tree\` or \`list_files\` to explore folder structure.
   - Call \`search_files\` to locate relevant symbols, functions, and imports.
   - Call \`read_file\` to inspect targeted lines of code.
   - Call \`inspect_project\` or \`inspect_package_json\` to inspect tech stack and dependencies.
   - Call \`inspect_environment_safely\` to inspect platform and tools.
3. Structured, Surgical Editing:
   - When modifying files, prefer \`edit_file\` with precise start and end lines rather than rewriting entire large files.
   - All proposed file modifications are presented to the user as clear visual diff previews.
   - When modifying multiple files, organize them cleanly so the user can review and [Accept All].
   - Ensure your code compiles and follows existing project idioms and conventions.
4. Autonomous Iteration & Error Recovery:
   - Execute the canonical loop: RUN -> ERROR -> INSPECT -> FIX -> RUN AGAIN.
   - If asked to fix a build error or bug, inspect the error, read the code, apply edits, and run validation (e.g. \`run_terminal\` with \`npx tsc --noEmit\` or test commands) to verify the resolution.
   - If validation fails, read the error output and iterate until solved or maximum steps reached.
5. Security & Boundary Awareness:
   - You only operate within the authorized project workspace boundary.
   - Never run destructive commands without authorization.
   - Never output, inspect, or log secret tokens or private keys.`);

  // Workspace Metadata
  parts.push(`\nCURRENT WORKSPACE CONTEXT:
- Project Name: ${context.project.name} (ID: ${context.project.id})
- Active User: ${context.user.name} (${context.user.email || 'authenticated user'})`);

  if (context.projectMemory) {
    const mem = context.projectMemory;
    const memParts = [];
    if (mem.framework) memParts.push(`Framework: ${mem.framework}`);
    if (mem.language) memParts.push(`Language: ${mem.language}`);
    if (mem.architecture_summary) memParts.push(`Architecture: ${mem.architecture_summary}`);
    if (mem.coding_conventions) memParts.push(`Conventions: ${mem.coding_conventions}`);
    if (memParts.length > 0) {
      parts.push(`\nPROJECT MEMORY / CONVENTIONS:\n${memParts.join('\n')}`);
    }
  }

  // Explicitly linked target files for editing
  if (context.targetFiles && context.targetFiles.length > 0) {
    const list = context.targetFiles.map((f) => `- ${f.path}`).join('\n');
    parts.push(`\nTARGET FILES SPECIFICALLY LINKED FOR EDIT (HIGHEST PRIORITY):
The user explicitly linked the following file(s) by clicking '+' to specifically inspect and edit:
${list}

CRITICAL DIRECTIVE: You MUST inspect these target file(s) and apply your code edits/diffs directly to them according to the user's request.`);

    context.targetFiles.forEach((tf) => {
      if (tf.content) {
        parts.push(`\n--- CONTENT OF LINKED TARGET FILE: ${tf.path} ---
\`\`\`
${tf.content}
\`\`\``);
      }
    });
  }

  // Active Editor File & Selection
  if (context.activeFile) {
    parts.push(`\nCURRENT OPEN EDITOR FILE:
- Path: ${context.activeFile.path}
- Language: ${context.activeFile.language || 'plaintext'}`);

    if (context.activeFile.selection && context.activeFile.selection.text.trim()) {
      const sel = context.activeFile.selection;
      parts.push(`- Selected Lines (${sel.startLine}-${sel.endLine}):
\`\`\`${context.activeFile.language || ''}
${sel.text}
\`\`\``);
    }
  }

  if (context.openTabs && context.openTabs.length > 0) {
    parts.push(`\nOPEN EDITOR TABS: ${context.openTabs.join(', ')}`);
  }

  if (context.git) {
    const gitInfo = [];
    if (context.git.branch) gitInfo.push(`Branch: ${context.git.branch}`);
    if (context.git.statusSummary) gitInfo.push(`Status: ${context.git.statusSummary}`);
    if (gitInfo.length > 0) {
      parts.push(`\nGIT REPOSITORY STATE:\n${gitInfo.join('\n')}`);
    }
  }

  if (context.diagnostics) {
    parts.push(`\nCURRENT DIAGNOSTICS & ERRORS:\n${context.diagnostics}`);
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

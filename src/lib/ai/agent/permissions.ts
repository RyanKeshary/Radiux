import { AIPermissionMode, AITool } from '../types';

export interface PermissionCheckResult {
  allowed: boolean;
  requiresConfirmation: boolean;
  reason?: string;
}

// Safe terminal command prefixes
const SAFE_COMMAND_PATTERNS = [
  /^(ls|dir)(\s+.*)?$/i,
  /^(pwd)(\s+.*)?$/i,
  /^(echo)(\s+.*)?$/i,
  /^(cat|type)(\s+.*)?$/i,
  /^(git\s+(status|diff|log|branch|show))(\s+.*)?$/i,
  /^(npm\s+(test|run\s+(test|build|lint|check)|-v|--version))(\s+.*)?$/i,
  /^(npx\s+(tsc\s+--noEmit|eslint|prettier\s+--check))(\s+.*)?$/i,
  /^(node\s+(-v|--version))$/i,
];

// Explicitly destructive commands that unconditionally require user confirmation
const DESTRUCTIVE_COMMAND_PATTERNS = [
  /\b(rm|del|rmdir|rd)\b/i,
  /\b(format|fdisk|mkfs)\b/i,
  /\b(shutdown|reboot)\b/i,
  /\b(git\s+reset\s+--hard)\b/i,
  /\b(git\s+clean\s+-[a-z]*f)\b/i,
  /\b(npm\s+(install|i|uninstall|remove|update)|yarn\s+(add|remove)|pnpm\s+(add|remove))\b/i,
  /\b(drop\s+table|truncate\s+table|delete\s+from)\b/i,
  /[>|;&]\s*\/dev\/(null|zero|random)/i,
];

export class PermissionEngine {
  static isSafeCommand(cmd: string): boolean {
    const trimmed = (cmd || '').trim();
    if (!trimmed) return false;

    // Reject anything matching destructive patterns immediately
    if (DESTRUCTIVE_COMMAND_PATTERNS.some((p) => p.test(trimmed))) {
      return false;
    }

    return SAFE_COMMAND_PATTERNS.some((p) => p.test(trimmed));
  }

  static check(
    tool: AITool,
    args: any,
    mode: AIPermissionMode
  ): PermissionCheckResult {
    const name = tool.name;

    // 1. Read-only operations are always permitted in all modes
    const readOnlyTools = [
      'list_files',
      'read_file',
      'search_files',
      'get_file_tree',
      'get_current_file',
      'get_selection',
      'git_status',
      'git_diff',
      'git_log',
      'diagnostics',
    ];

    if (readOnlyTools.includes(name)) {
      return { allowed: true, requiresConfirmation: false };
    }

    // 2. In READ_ONLY mode, all modifying or execution tools are strictly prohibited
    if (mode === 'READ_ONLY') {
      return {
        allowed: false,
        requiresConfirmation: false,
        reason: `Tool "${name}" is not permitted in READ_ONLY mode. Switch to ASSISTED or AUTONOMOUS to allow changes.`,
      };
    }

    // 3. Destructive tool: delete_file always requires explicit user confirmation
    if (name === 'delete_file') {
      return {
        allowed: true,
        requiresConfirmation: true,
        reason: `Deleting file "${args.path}" requires explicit confirmation.`,
      };
    }

    // 4. File write / edit
    if (name === 'write_file' || name === 'edit_file') {
      if (mode === 'ASSISTED') {
        // Assisted mode requires user confirmation / review of diff before persisting
        return {
          allowed: true,
          requiresConfirmation: true,
          reason: `Review and confirm proposed modifications to "${args.path}".`,
        };
      }
      // Autonomous mode allows proposing and applying directly with reviewable diff
      return { allowed: true, requiresConfirmation: false };
    }

    // 5. Terminal execution
    if (name === 'run_terminal') {
      const command = args.command || '';
      const isSafe = this.isSafeCommand(command);

      if (isSafe) {
        return { allowed: true, requiresConfirmation: false };
      }

      // Any non-safe or potentially destructive terminal command requires user confirmation
      return {
        allowed: true,
        requiresConfirmation: true,
        reason: `Execution of command "${command}" requires explicit confirmation.`,
      };
    }

    return { allowed: true, requiresConfirmation: false };
  }
}

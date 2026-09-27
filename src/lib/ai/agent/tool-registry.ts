import { AITool } from '../types';

/**
 * 14 Core Tools for Radiux Coding Agent
 */
export const CORE_AI_TOOLS: AITool[] = [
  {
    name: 'list_files',
    description: 'List files and directories in the workspace under a given directory path.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative directory path to list (e.g. "src" or "" for workspace root).',
          default: '',
        },
        recursive: {
          type: 'boolean',
          description: 'Whether to list files recursively.',
          default: false,
        },
        maxDepth: {
          type: 'number',
          description: 'Maximum depth when listing recursively.',
          default: 3,
        },
      },
    },
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file in the workspace with optional line ranges.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path to the file to read (e.g. "src/app/page.tsx").',
        },
        startLine: {
          type: 'number',
          description: 'Starting line number (1-indexed, inclusive). Optional.',
        },
        endLine: {
          type: 'number',
          description: 'Ending line number (1-indexed, inclusive). Optional.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_files',
    description: 'Search for text or regex pattern across workspace files.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search string or pattern.',
        },
        path: {
          type: 'string',
          description: 'Relative subdirectory to search within (e.g. "src" or "" for whole project).',
          default: '',
        },
        caseSensitive: {
          type: 'boolean',
          description: 'Whether search should be case sensitive.',
          default: false,
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of match results to return.',
          default: 20,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_file_tree',
    description: 'Get a compact tree representation of the workspace folder hierarchy.',
    parameters: {
      type: 'object',
      properties: {
        maxDepth: {
          type: 'number',
          description: 'Maximum directory nesting depth.',
          default: 3,
        },
      },
    },
  },
  {
    name: 'get_current_file',
    description: 'Get the currently active open file in the user editor, its path, language, and selection.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_selection',
    description: 'Get the exact text currently highlighted/selected by the user in the active editor.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'write_file',
    description: 'Create a new file or completely overwrite an existing file with new content. Proposes a diff.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path of the file to create or replace.',
        },
        content: {
          type: 'string',
          description: 'The full text content to write into the file.',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Perform targeted, structured line edits on an existing file without rewriting the entire file. Proposes a diff.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path of the file to edit.',
        },
        edits: {
          type: 'array',
          description: 'List of edits to apply to the file.',
          items: {
            type: 'object',
          },
        },
      },
      required: ['path', 'edits'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file from the workspace. Destructive operation that always requires user confirmation.',
    dangerous: true,
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path of the file to delete.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'run_terminal',
    description: 'Execute a command in the workspace terminal. Safe commands execute directly; destructive commands require user confirmation.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The terminal command to execute (e.g. "npx tsc --noEmit" or "npm test").',
        },
        cwd: {
          type: 'string',
          description: 'Optional relative directory to execute within.',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'git_status',
    description: 'Inspect the current Git status (branch, modified files, untracked files).',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'git_diff',
    description: 'Inspect Git diff of uncommitted modifications in the workspace.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Optional file path to restrict diff to.',
        },
        cached: {
          type: 'boolean',
          description: 'Whether to show staged diff (git diff --cached).',
          default: false,
        },
      },
    },
  },
  {
    name: 'git_log',
    description: 'Get recent git commit history for the project.',
    parameters: {
      type: 'object',
      properties: {
        maxCommits: {
          type: 'number',
          description: 'Number of recent commits to retrieve.',
          default: 5,
        },
      },
    },
  },
  {
    name: 'create_file',
    description: 'Create a new file in the workspace with initial content. Proposes a diff or creates the file.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path of the new file to create.',
        },
        content: {
          type: 'string',
          description: 'Initial text content for the file.',
          default: '',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'apply_editor_edit',
    description: 'Apply targeted structured edits to the active editor file or workspace file. Directly reflects in Monaco editor and generates diff proposal.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path of the file to edit.',
        },
        edits: {
          type: 'array',
          description: 'List of edits to apply with startLine, endLine, and replacement content.',
          items: {
            type: 'object',
          },
        },
      },
      required: ['path', 'edits'],
    },
  },
  {
    name: 'get_open_tabs',
    description: 'Get the list of currently open tabs/files in the editor workspace.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_editor_state',
    description: 'Get detailed active editor state, cursor line/col, active selection, open tabs, and dirty files.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_diagnostics',
    description: 'Inspect compiler errors, TypeScript errors, and editor diagnostics in the workspace.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Type of diagnostics to check ("typescript" | "build" | "general").',
          default: 'typescript',
        },
      },
    },
  },
  {
    name: 'diagnostics',
    description: 'Alias for get_diagnostics: inspect compiler errors and workspace problems.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Type of diagnostics to check ("typescript" | "build" | "general").',
          default: 'typescript',
        },
      },
    },
  },
  {
    name: 'git_branch',
    description: 'Inspect the current git branch and list of available branches.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'inspect_project',
    description: 'Inspect project structure, framework configuration, build scripts, and tech stack overview.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'inspect_package_json',
    description: 'Inspect project dependencies, devDependencies, and npm scripts in package.json.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'inspect_project_context',
    description: 'Inspect project AI context, conventions, framework details, and architectural guidelines.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'inspect_collaboration_state',
    description: 'Inspect the real-time collaboration state: active peers, connected collaborators, and which files they are viewing.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'inspect_project_members',
    description: 'Inspect project members and their role-based access control (RBAC) privileges (owner, editor, visitor).',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'run_typecheck',
    description: 'Run TypeScript compiler typecheck (npx tsc --noEmit) to validate code correctness and verify zero compiler errors.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'run_build',
    description: 'Run the project build script (npm run build) to validate that the application compiles without errors.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'run_tests',
    description: 'Run the project tests (npm test) to validate test suite passing status.',
    parameters: {
      type: 'object',
      properties: {
        testCommand: {
          type: 'string',
          description: 'Optional custom test command (defaults to "npm test").',
        },
      },
    },
  },
  {
    name: 'inspect_environment_safely',
    description: 'Inspect runtime platform, Node/Git versions, and available tooling safely without exposing secrets.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
];

export class ToolRegistry {
  private tools: Map<string, AITool> = new Map();

  constructor(initialTools: AITool[] = CORE_AI_TOOLS) {
    for (const tool of initialTools) {
      this.tools.set(tool.name, tool);
    }
  }

  private static readonly FAST_CORE_NAMES = new Set([
    'read_file',
    'edit_file',
    'create_file',
    'list_files',
    'search_files',
    'get_file_tree',
    'run_terminal',
    'run_typecheck',
    'get_editor_state',
    'git_status',
    'git_diff',
    'delete_file',
  ]);

  get(name: string): AITool | undefined {
    return this.tools.get(name);
  }

  getAll(fastCoreOnly = true): AITool[] {
    if (fastCoreOnly) {
      return Array.from(this.tools.values()).filter((t) =>
        ToolRegistry.FAST_CORE_NAMES.has(t.name)
      );
    }
    return Array.from(this.tools.values());
  }

  register(tool: AITool): void {
    this.tools.set(tool.name, tool);
  }
}

export const defaultToolRegistry = new ToolRegistry();

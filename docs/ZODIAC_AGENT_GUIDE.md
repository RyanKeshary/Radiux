# Zodiac 1.0 — Native Agentic AI Engine for Radiux

## 1. Overview & Architecture

Zodiac 1.0 is the native autonomous AI engineering agent built directly into the Radiux collaborative cloud IDE. Unlike traditional chatbots that merely return conversational responses, Zodiac is an active engineering system that inspects workspace state, explores codebases, calculates surgical diffs, runs terminal commands, executes compiler validation, and recovers from errors autonomously.

### Architectural Flow:
```
User Goal
    ↓
Progressive Context Builder (Active Editor, Tabs, Git, RBAC, Diagnostics)
    ↓
Zodiac Agent Loop
    ↓
LLM Provider Abstraction (Groq Llama 3.3 70B / Provider Agnostic)
    ↓
Permission Engine (READ_ONLY | ASSISTED | AUTONOMOUS)
    ↓
Tool Router & Executor
    ↓
Workspace Tools (Filesystem, Terminal, Git, Diagnostics, Validation)
    ↓
Monaco + Yjs Collaborative Bridge (Instant Peer Sync)
    ↓
Validation Loop (Typecheck / Build / Tests)
    ↓
Concise Verification Summary
```

---

## 2. Environment Variables

The server strictly loads configuration server-side. **No client-side exposure of API keys is permitted** (never use `NEXT_PUBLIC_GROQ_API_KEY`).

```env
# AI Provider (Server-Side Only)
GROQ_API_KEY=your_groq_api_key_here
AI_MODEL=llama-3.3-70b-versatile
AI_MAX_STEPS=30
AI_MAX_CONTEXT=128000
AI_MAX_OUTPUT=4096
AI_DEFAULT_PERMISSION_MODE=ASSISTED

# Supabase Auth & PostgreSQL
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Admin & Analytics
ADMIN_EMAIL=ryankeshary@gmail.com
```

---

## 3. Permission Modes

Zodiac enforces a 3-tier permission model validated strictly server-side:

| Mode | Inspection & Reads | Code Modifications | Terminal Execution | Confirmation Required |
| :--- | :--- | :--- | :--- | :--- |
| **`READ_ONLY`** | Allowed | Denied | Denied | N/A |
| **`ASSISTED`** *(Default)* | Allowed | Proposes visual diffs | Safe commands only | Destructive & write operations prompt user |
| **`AUTONOMOUS`** | Allowed | Direct surgical edits & diff generation | Safe commands & validation | Destructive operations (`delete_file`, etc.) still prompt |

---

## 4. Task Intent Modes

Zodiac supports targeted task modes to prevent unnecessary token consumption and ensure focused execution:

- **`ASK`**: Answers questions using project context. Does not edit files.
- **`EXPLAIN`**: Explains selected code or active file without modifying code.
- **`EDIT`**: Makes surgical code changes and generates structured diffs.
- **`DEBUG`**: Investigates errors, inspects offending files, resolves root causes, and validates.
- **`BUILD`**: Runs build compilation (`npm run build`) and fixes compiler errors.
- **`TEST`**: Executes test suites and diagnoses failures.
- **`REVIEW`**: Conducts code reviews and outputs constructive recommendations.
- **`AGENT`**: Full autonomous multi-step coding workflow within configured permissions.

---

## 5. Tool Registry & Contracts

Every tool call is strictly boundary-checked against directory traversal escaping the workspace root.

### File Tools
- `list_files(path?)`: Lists files and directories within the workspace.
- `get_file_tree(maxDepth?)`: Generates an ASCII tree view of the workspace hierarchy.
- `read_file(path, startLine?, endLine?)`: Reads line-numbered snippets of a specific file.
- `search_files(query, path?, caseSensitive?, maxResults?)`: Fast content search across project files.
- `write_file(path, content)`: Replaces file content and generates a diff proposal.
- `create_file(path, content)`: Creates a new file in the workspace with initial content.
- `edit_file(path, edits)`: Targeted surgical edits with line-range replacements.
- `apply_editor_edit(path, edits)`: Applies edits to open Monaco models and broadcasts to Yjs.
- `delete_file(path)`: Destructive removal of a file (requires explicit approval).

### Editor & Collaboration Tools
- `get_current_file()`: Inspects the active file open in the Monaco editor.
- `get_selection()`: Reads the user's active code selection.
- `get_open_tabs()`: Lists all open editor tabs.
- `get_editor_state()`: Reads cursor position, dirty files, and editor state.
- `inspect_collaboration_state()`: Inspects active connected peers and open files.
- `inspect_project_members()`: Lists project collaborators and RBAC roles.

### Terminal & Git Tools
- `run_terminal(command, cwd?)`: Executes a command in the project terminal.
- `git_status()`: Inspects uncommitted and untracked changes.
- `git_diff(path?, cached?)`: Inspects git diffs.
- `git_log(maxCommits?)`: Retrieves recent commit history.
- `git_branch()`: Lists branches and identifies active branch.

### Project & Validation Tools
- `inspect_project()`: Identifies tech stack (Next.js, Vite, TypeScript, Tailwind).
- `inspect_package_json()`: Inspects dependencies, devDependencies, and scripts.
- `inspect_project_context()`: Reads persistent project AI memory and architecture conventions.
- `inspect_environment_safely()`: Returns runtime OS and tool versions with zero secret exposure.
- `run_typecheck()`: Runs TypeScript compiler (`npx tsc --noEmit`) to verify 0 errors.
- `run_build()`: Executes production build (`npm run build`).
- `run_tests(testCommand?)`: Executes test suite (`npm test`).
- `get_diagnostics(type?)`: Reads compiler and workspace diagnostics.

---

## 6. Real-Time Monaco & Yjs Collaboration Integration

When Zodiac modifies files that are currently open in the Monaco editor:
1. Changes are applied via Monaco's `executeEdits` transaction API using the `radiux:apply-editor-content` event.
2. `y-monaco` observes the Monaco model transaction and immediately updates the shared Yjs document.
3. Connected peers receive real-time edits without needing to refresh or re-read files from disk.

---

## 7. Role-Based Access Control (RBAC)

Zodiac tools enforce Radiux project privileges server-side:
- **`owner`**: Full project control, file editing, terminal execution, and settings management.
- **`editor`**: Standard development, file editing, and terminal execution within permission mode.
- **`visitor`**: Strictly read-only. File modification tools (`write_file`, `create_file`, `edit_file`, `apply_editor_edit`, `delete_file`) and `run_terminal` are rejected server-side with HTTP 403.

---

## 8. Database Schema

Schema migrations (`supabase/schema_v13_ai_and_admin.sql`, `supabase/schema_v16_zodiac_agentic_core.sql`):
- `ai_conversations`: Tracks conversation sessions and default permission modes.
- `ai_messages`: Stores message history, role, and structured tool metadata.
- `ai_tasks`: Persists multi-step task state, goal, status, inspected files, modified files, and validation results.
- `ai_tool_calls`: Logs every tool execution, duration, and success status.
- `ai_feedback`: Captures user satisfaction ratings (`thumbs_up` / `thumbs_down`) and categories.
- `ai_project_context`: Stores persistent architecture notes and coding conventions.
- `ai_usage`: Tracks token count, latency, and model metrics for admin analytics.

---

## 9. Important Limitations

> **NOTICE: Cloud Workspace Sandboxing**  
> Cloud workspace sandboxing (e.g. isolated Docker containers or ephemeral remote microVMs) is currently out of scope for this task. Terminal commands execute within the host node environment restricted to the project's workspace directory path boundary.

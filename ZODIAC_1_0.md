# ZODIAC 1.0 — Native AI Coding Agent Architecture

## 1. Overview & Identity

**Zodiac 1.0** is the official, native AI coding agent built into Radiux.

Rather than a detached, generic chat bubble, Zodiac 1.0 is engineered as an integrated coding agent capable of multi-step reasoning, workspace inspection, diagnostics awareness, surgical file editing, and iterative test validation.

---

## 2. Core Agentic Loop

Zodiac runs an autonomous, multi-turn tool execution loop:

```
                  ┌────────────────────────────────────────┐
                  │                 USER                   │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │      Progressive Context Builder       │
                  │ (Active file, selection, tree, diag)   │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │         Zodiac 1.0 LLM Engine          │
                  │        (Groq Llama 3.3 70B)            │
                  └─────────┬───────────────────▲──────────┘
                            │                   │
                     Tool Call Decision         │ Next Tool Call or
                            │                   │ Streaming Response
                            ▼                   │
                  ┌───────────────────┐         │
                  │   Tool Registry   │         │
                  │    (17 Tools)     │         │
                  └─────────┬─────────┘         │
                            │                   │
                  ┌─────────▼─────────┐         │
                  │   RBAC & Security │         │
                  │  (Visitor blocked)│         │
                  └─────────┬─────────┘         │
                            │                   │
                  ┌─────────▼─────────┐         │
                  │   Tool Executor   │─────────┘
                  │ (Filesystem/Git/  │
                  │   Terminal/Diag)  │
                  └───────────────────┘
```

### 2.1 Autonomous Error Recovery Loop
When tasked with fixing a broken build or failed test, Zodiac executes the recovery pattern:

```
RUN ($ npx tsc --noEmit / npm test)
 ↓
ERROR (Capture compiler/test diagnostic output)
 ↓
INSPECT (Search and read failing source files)
 ↓
FIX (Generate surgical diff proposal)
 ↓
RUN AGAIN (Verify exit code === 0)
 ↓
SUCCESS / COMPLETION
```

---

## 3. Canonical 17 Tool Registry

Zodiac 1.0 maintains one canonical, deterministic tool registry:

1. `list_files`: List files in any directory within the workspace.
2. `get_file_tree`: Retrieve the complete recursive workspace folder tree.
3. `read_file`: Read the full content of a project file.
4. `search_files`: Regex or literal pattern search across the workspace.
5. `get_current_file`: Read the active editor file and cursor position.
6. `get_selection`: Read the highlighted code snippet from Monaco.
7. `write_file`: Create or overwrite a file.
8. `edit_file`: Propose a surgical patch/diff to modify an existing file.
9. `delete_file`: Delete a file (requires explicit confirmation).
10. `run_terminal`: Execute a command in the project terminal.
11. `git_status`: Inspect working tree status, staged/unstaged changes.
12. `git_diff`: Inspect line diffs for a file or entire repository.
13. `git_log`: View recent Git commit history.
14. `diagnostics`: Fetch active Monaco problems, linter errors, and compiler warnings.
15. `inspect_project`: Analyze package manifests, frameworks, branch, and open tabs.
16. `inspect_package_json`: Read and parse `package.json` dependencies and scripts.
17. `inspect_environment_safely`: Safe inspection of node runtime version, OS, and PATH (secrets are never returned).

---

## 4. Permission Modes

Zodiac supports three user-controlled execution modes:

- **`READ_ONLY`**: Zodiac can only inspect, search, and analyze. All write, edit, and execution tools are disabled.
- **`ASSISTED` (Default)**: Zodiac can read, search, and run safe commands (`ls`, `git status`, `npm test`, `npx tsc`). File modifications and terminal commands require user confirmation via diff review.
- **`AUTONOMOUS`**: Zodiac can iteratively write files, run tests, inspect errors, and re-run commands until completion or `maxSteps` is reached. Dangerous/destructive commands (`rm`, `git reset --hard`) still mandate confirmation.

---

## 5. Surgical Diff Engine & Yjs Collaboration

Zodiac does not blindly overwrite whole files when small modifications suffice.
1. Edits generate structured diff proposals containing `path`, `oldContent`, and `newContent`.
2. Diff viewers allow developers to `[Accept]`, `[Reject]`, or `[Review]` changes. Multi-file edits support `[Accept All]` and `[Reject All]`.
3. When accepted, changes apply directly through Monaco's edit transaction and propagate across Yjs CRDTs to all connected peers in real time.

---

## 6. Project Memory & Architecture Context

Zodiac supports an explicit, editable **Project Memory Drawer**:
- Developers can specify coding guidelines, preferred libraries, naming conventions, and architectural constraints.
- Project memory is persisted and injected into Zodiac's system prompt without dumping massive conversation histories.

---

## 7. Security & Secret Isolation

- The Groq API key (`GROQ_API_KEY`) is stored strictly server-side in environment variables and never exposed to the client.
- Tool arguments are validated on the server.
- The execution daemon runs within a sanitized environment that strips Supabase, Groq, and database credentials before launching any command.
- If the current workspace member has the `Visitor` role, all mutating tools are rejected with permission errors.

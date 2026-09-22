# Radiux — Repository Cleanup Audit & Log (Phase 1)

This document records the cleanup of obsolete references, deprecated branding, dead notification/activity hooks, and outdated storage keys in accordance with Phase 1.

---

## 1. Brand Alignment & Namespace Migration
- **Cloud Backend Fallback**:
  - Updated `src/lib/config.ts` fallback URLs from `codecollab-backend-isjt.onrender.com` to `radiux-backend.onrender.com` (matching `render.yaml` service definition: `radiux-backend`).
- **LocalStorage Keys Migrated**:
  - `codecollab_dock_orientation` → `radiux_dock_orientation` (with backwards-compatible fallback read).
  - `codecollab_sidebar_width_*` → `radiux_sidebar_width_*` (with fallback read).
  - `codecollab_dock_height_*` → `radiux_dock_height_*` (with fallback read).
  - `codecollab_dock_width_*` → `radiux_dock_width_*` (with fallback read).
  - `codecollab_workspace_*` → `radiux_workspace_*` (with fallback read).
  - `codecollab_last_project_id` & `codecollab_last_project_name` → `radiux_last_project_id` & `radiux_last_project_name`.
  - `codecollab_editor_settings` → `radiux_editor_settings`.

---

## 2. Server Cleanup
- **`server/websocket.mjs`**:
  - Removed dangling calls to undefined functions `markGlobalNotificationRead()` and `deleteGlobalNotification()` in partner management routines.
  - Retained active endpoints: `/health`, `/api/terminal/profiles`, `/api/terminal/sessions`, `/api/workspace/exec`, `/api/git/*`, and Yjs synchronization WebSocket connections.

---

## 3. Retained Core Components & Files
The following files were reviewed and intentionally retained:
- `server/test-shells.mjs`: Standalone testing script for local shell detection (PowerShell, CMD, Git Bash, WSL).
- `supabase/schema_*.sql`: All migrations retained in chronological order to preserve upgrade paths.
- `render.yaml` & `DEPLOYMENT.md`: Active deployment configurations for production backend on Render.
- `AI_ARCHITECTURE.md`: Architecture reference for the multi-step agent and Monaco integration.

---

## 4. Verification Check
- TypeScript type-check and dependency imports remain clean.

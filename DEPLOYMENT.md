# CodeCollab — Production Deployment Guide (Level 6)

This document provides step-by-step instructions for deploying CodeCollab to production.

---

## Architecture Overview

CodeCollab consists of three decoupled production components:
1. **Frontend**: Next.js 14 App Router application (deployable to Vercel, Netlify, Cloudflare Pages, or Docker).
2. **Collaboration & Runtime Backend**: Node.js WebSocket + Express REST server (`server/websocket.mjs`) handling Yjs CRDT synchronization, terminal PTY sessions, WebRTC voice signaling, and Git execution (deployable to Railway, Render, Fly.io, or VPS).
3. **Database, Auth & Storage**: Supabase PostgreSQL + Auth + Realtime + Storage.

---

## Step 1: Supabase Setup

### 1. Run Database Migrations
1. Open your Supabase Project Dashboard -> **SQL Editor**.
2. Run `supabase/schema.sql` (if starting fresh).
3. Run `supabase/schema_v6.sql` (to apply additive production indexes, media columns, and RLS policies).

### 2. Configure Storage Bucket for Media
1. In Supabase Dashboard -> **Storage**.
2. If not created automatically by `schema_v6.sql`, create a public bucket named:
   - **Name**: `chat-media`
   - **Public**: `true`
   - **Max file size**: `50MB`
   - **Allowed MIME types**: `image/*`, `video/*`, `audio/*`, `application/pdf`, `text/*`, `application/zip`

### 3. Configure Authentication & OAuth
In Supabase Dashboard -> **Authentication** -> **URL Configuration**:
- **Site URL**:
  - Development: `http://localhost:3000`
  - Production: `https://your-app-domain.com`
- **Redirect URLs**:
  - Development: `http://localhost:3000/**`
  - Production: `https://your-app-domain.com/**`

#### Enabling Google & GitHub OAuth
In Supabase Dashboard -> **Authentication** -> **Providers**:
- **Google**: Enable and paste Client ID & Client Secret from Google Cloud Console.
- **GitHub**: Enable and paste Client ID & Client Secret from GitHub Developer Settings.
  - Set GitHub Authorization callback URL to:
    `https://<your-supabase-project-id>.supabase.co/auth/v1/callback`

---

## Step 2: Deploy Collaboration & Runtime Backend (`server/websocket.mjs`)

Because the collaboration server requires persistent WebSockets and runtime access for PTY terminals and Git, host it on a platform that supports WebSockets and long-lived server processes (e.g. **Railway**, **Render**, or **Fly.io**).

### Example Deployment on Railway:
1. Connect your repository to Railway.
2. Set the root directory or start command:
   ```bash
   node server/websocket.mjs
   ```
3. Set the Environment Variables in Railway:
   - `PORT`: `1234` (or provided by host)
   - `NODE_ENV`: `production`
   - `ALLOWED_ORIGIN`: `https://your-frontend-domain.com`
   - `SUPABASE_URL`: `https://your-project.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: `<your-supabase-service-role-key>`
4. Note your public Railway service URL (e.g. `https://codecollab-server.up.railway.app`).
   - WebSocket URL: `wss://codecollab-server.up.railway.app`
   - API URL: `https://codecollab-server.up.railway.app`

---

## Step 3: Deploy Frontend (Vercel or Node Host)

### Example Deployment on Vercel:
1. Import your Git repository into Vercel.
2. In Project Settings -> **Environment Variables**, configure:
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://your-project.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `<your-anon-key>`
   - `NEXT_PUBLIC_APP_URL`: `https://your-frontend-domain.com`
   - `NEXT_PUBLIC_WS_URL`: `wss://codecollab-server.up.railway.app`
   - `NEXT_PUBLIC_API_URL`: `https://codecollab-server.up.railway.app`
3. Deploy!

---

## Step 4: Verification Checklist

- [ ] Sign up with email/password, Google OAuth, and GitHub OAuth.
- [ ] Create a new project and verify real-time Yjs editing between two browser sessions.
- [ ] Send chat messages with image, video, audio, and documents; verify they upload to Supabase Storage and open in the in-project viewer.
- [ ] Click "Open in Editor Tab" on chat media; verify it renders in the central editor via `MediaViewer`.
- [ ] Open the terminal in split/bottom dock, maximize to fullscreen, and verify it fills the container without truncation.
- [ ] Test Git staging, commit, and branch switching in the Git panel.

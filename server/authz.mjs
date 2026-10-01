/**
 * Radiux — Backend Authorization
 * ==============================
 * Central, server-side authorization for the WebSocket/PTY companion server.
 *
 * Security model
 * --------------
 * Roles are NEVER read from the request. They are resolved from the database using
 * the caller's *verified* Supabase identity:
 *
 *   1. Extract the JWT from the `Authorization: Bearer <token>` header (or a
 *      `token` query parameter for WebSocket upgrades, which cannot set headers).
 *   2. Verify the JWT against Supabase Auth using the service-role client.
 *   3. Look up the caller's effective role for the target project:
 *        - projects.owner_id = user  -> 'owner'
 *        - project_members.role     -> 'owner' | 'editor' | 'visitor' | 'member'
 *   4. Compare that role against the capability required by the route.
 *
 * Fail-closed by default
 * ----------------------
 * If the service-role credentials are missing, requests are refused with 503
 * rather than being allowed through. Local development without Supabase can opt
 * out explicitly with RADIUX_ALLOW_ANONYMOUS=1, which is logged loudly at boot.
 */

/** Capability matrix. Keep this as the single source of truth. */
const WRITE_ROLES = new Set(['owner', 'editor']);
const READ_ROLES = new Set(['owner', 'editor', 'visitor']);

/** Legacy DB value 'member' behaves like 'editor'. */
function normalizeRole(role) {
  if (!role) return null;
  const r = String(role).toLowerCase();
  if (r === 'member') return 'editor';
  if (r === 'owner' || r === 'editor' || r === 'visitor') return r;
  return null;
}

/**
 * Local-dev escape hatch. Never enabled implicitly.
 */
export function isAnonymousAllowed() {
  return process.env.RADIUX_ALLOW_ANONYMOUS === '1';
}

/**
 * True when the server has the credentials it needs to authenticate anyone.
 */
export function isAuthConfigured(supabaseAdmin) {
  return Boolean(supabaseAdmin);
}

/**
 * Pull a bearer token out of an HTTP request.
 */
export function extractBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  return match ? match[1].trim() : '';
}

/**
 * Verify a Supabase access token. Returns the user object or null.
 */
export async function verifyToken(supabaseAdmin, token) {
  if (!token || !supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

/**
 * Resolve the caller's effective role for a project, straight from the database.
 * Returns null when the user is not a member and not the owner.
 */
export async function resolveProjectRole(supabaseAdmin, userId, projectId) {
  if (!supabaseAdmin || !userId || !projectId || projectId === 'default') return null;

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(projectId)) return null;

  try {
    const { data: member, error: memberErr } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!memberErr && member) {
      const role = normalizeRole(member.role);
      if (role) return role;
    }

    const { data: project, error: projectErr } = await supabaseAdmin
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .maybeSingle();

    if (!projectErr && project && project.owner_id === userId) return 'owner';
  } catch {
    // fall through to deny
  }
  return null;
}

/**
 * Authorize a request against a project.
 *
 * @param {object}      opts
 * @param {object|null} opts.supabaseAdmin  Verified service-role Supabase client.
 * @param {string}      opts.token          Raw JWT from the request.
 * @param {string}      opts.projectId      Target project.
 * @param {boolean}     [opts.requireWrite] True when the route mutates state.
 * @returns {Promise<{ok: boolean, status: number, error?: string, role?: string, userId?: string}>}
 */
export async function authorizeProject({
  supabaseAdmin,
  token,
  projectId,
  requireWrite = false,
}) {
  // Explicit local-dev opt-out. Still resolves a role so route logic keeps working.
  if (!isAuthConfigured(supabaseAdmin)) {
    if (isAnonymousAllowed()) {
      return { ok: true, status: 200, role: 'owner', userId: 'anonymous-dev', anonymous: true };
    }
    return {
      ok: false,
      status: 503,
      error:
        'Server authorization is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, ' +
        'or set RADIUX_ALLOW_ANONYMOUS=1 for local development only.',
    };
  }

  const user = await verifyToken(supabaseAdmin, token);
  if (!user) {
    return { ok: false, status: 401, error: 'Authentication required.' };
  }

  const role = await resolveProjectRole(supabaseAdmin, user.id, projectId);
  if (!role) {
    return { ok: false, status: 403, error: 'You are not a member of this project.' };
  }

  const permitted = requireWrite ? WRITE_ROLES.has(role) : READ_ROLES.has(role);
  if (!permitted) {
    return {
      ok: false,
      status: 403,
      error: `Role "${role}" is not permitted to ${requireWrite ? 'modify' : 'access'} this workspace.`,
    };
  }

  return { ok: true, status: 200, role, userId: user.id };
}
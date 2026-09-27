import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const LEAD_ADMIN_EMAIL = 'ryankeshary@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123456';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'radiux-master-admin-secret-key-2026';

const ADMIN_STORE_PATH = path.resolve(process.cwd(), '.workspaces', 'admins.json');

export interface AdminRecord {
  email: string;
  name?: string;
  role: 'lead_admin' | 'admin';
  addedBy?: string;
  addedAt: string;
}

function loadPersistedAdmins(): AdminRecord[] {
  try {
    if (fs.existsSync(ADMIN_STORE_PATH)) {
      const raw = fs.readFileSync(ADMIN_STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

function savePersistedAdmins(admins: AdminRecord[]): void {
  try {
    const dir = path.dirname(ADMIN_STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ADMIN_STORE_PATH, JSON.stringify(admins, null, 2), 'utf8');
  } catch (e) {
    console.error('[AdminAuth] Failed to save admins to disk:', e);
  }
}

export function getAdminList(): AdminRecord[] {
  const persisted = loadPersistedAdmins();
  const list: AdminRecord[] = [
    {
      email: LEAD_ADMIN_EMAIL,
      name: 'Ryan Keshary',
      role: 'lead_admin',
      addedBy: 'system',
      addedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  for (const item of persisted) {
    if (item.email.toLowerCase() !== LEAD_ADMIN_EMAIL.toLowerCase()) {
      list.push(item);
    }
  }

  // Also include any from ADMIN_EMAIL env var
  if (process.env.ADMIN_EMAIL) {
    const envEmails = process.env.ADMIN_EMAIL.split(',').map((e) => e.trim().toLowerCase());
    for (const em of envEmails) {
      if (em && em !== LEAD_ADMIN_EMAIL && !list.some((a) => a.email.toLowerCase() === em)) {
        list.push({
          email: em,
          name: em.split('@')[0],
          role: 'admin',
          addedBy: 'environment',
          addedAt: new Date().toISOString(),
        });
      }
    }
  }

  return list;
}

export function isLeadAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === LEAD_ADMIN_EMAIL.toLowerCase();
}

export function isUserAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  if (clean === LEAD_ADMIN_EMAIL.toLowerCase()) return true;
  const admins = getAdminList();
  return admins.some((a) => a.email.toLowerCase() === clean);
}

export function isUserAdmin(user?: any | null): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'lead_admin') return true;
  return isUserAdminEmail(user.email);
}

export async function addAdmin(
  targetEmail: string,
  targetName: string = '',
  addedByEmail: string = LEAD_ADMIN_EMAIL
): Promise<{ success: boolean; admin?: AdminRecord; message: string }> {
  const cleanEmail = targetEmail.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, message: 'Invalid email address.' };
  }

  if (cleanEmail === LEAD_ADMIN_EMAIL.toLowerCase()) {
    return { success: false, message: `${LEAD_ADMIN_EMAIL} is already the Lead Admin.` };
  }

  const current = loadPersistedAdmins();
  const existingIdx = current.findIndex((a) => a.email.toLowerCase() === cleanEmail);

  const newRecord: AdminRecord = {
    email: cleanEmail,
    name: targetName.trim() || cleanEmail.split('@')[0],
    role: 'admin',
    addedBy: addedByEmail,
    addedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    current[existingIdx] = newRecord;
  } else {
    current.push(newRecord);
  }

  savePersistedAdmins(current);

  // Sync to Supabase profiles table if available
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      await supabase
        .from('profiles')
        .update({ role: 'admin', updated_at: new Date().toISOString() })
        .eq('email', cleanEmail);
    } catch (e) {
      console.warn('[AdminAuth] Partial sync to Supabase profiles failed:', e);
    }
  }

  return {
    success: true,
    admin: newRecord,
    message: `Successfully granted Admin privileges to ${cleanEmail}.`,
  };
}

export async function removeAdmin(
  targetEmail: string
): Promise<{ success: boolean; message: string }> {
  const cleanEmail = targetEmail.trim().toLowerCase();
  if (cleanEmail === LEAD_ADMIN_EMAIL.toLowerCase()) {
    return { success: false, message: 'The Lead Admin cannot be removed or demoted.' };
  }

  const current = loadPersistedAdmins();
  const filtered = current.filter((a) => a.email.toLowerCase() !== cleanEmail);
  savePersistedAdmins(filtered);

  // Sync to Supabase profiles table
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      await supabase
        .from('profiles')
        .update({ role: 'user', updated_at: new Date().toISOString() })
        .eq('email', cleanEmail);
    } catch (e) {
      console.warn('[AdminAuth] Partial sync to Supabase profiles failed:', e);
    }
  }

  return {
    success: true,
    message: `Successfully revoked admin privileges from ${cleanEmail}.`,
  };
}

export const ADMIN_CONFIG = {
  email: LEAD_ADMIN_EMAIL,
  defaultUsername: 'admin',
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/**
 * Check if the provided credentials match the master admin credentials
 */
export function validateMasterAdmin(identifier: string, password: string): boolean {
  if (!identifier || !password) return false;
  const cleanId = identifier.trim().toLowerCase();
  const cleanPass = password.trim();

  const isEmailMatch = isUserAdminEmail(cleanId);
  const isUsernameMatch = cleanId === 'admin' || cleanId === 'ryankeshary';
  const isPassMatch = cleanPass === ADMIN_PASSWORD;

  return (isEmailMatch || isUsernameMatch) && isPassMatch;
}

/**
 * Generate a signed tamper-proof admin token valid for 7 days
 */
export function generateAdminToken(
  email: string = LEAD_ADMIN_EMAIL,
  role: 'lead_admin' | 'admin' = isLeadAdminEmail(email) ? 'lead_admin' : 'admin'
): string {
  const payload = {
    role,
    email: email.trim().toLowerCase(),
    userId: isLeadAdminEmail(email) ? 'admin-lead-root' : `admin-${Buffer.from(email).toString('hex').slice(0, 16)}`,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', ADMIN_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  return `rad_adm.${payloadBase64}.${signature}`;
}

/**
 * Verify if the given token is a valid master admin token
 */
export function verifyMasterAdminToken(
  token: string
): { valid: boolean; role?: 'lead_admin' | 'admin'; email?: string; userId?: string } {
  if (!token || !token.startsWith('rad_adm.')) return { valid: false };
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false };

    const [, payloadBase64, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', ADMIN_SECRET)
      .update(payloadBase64)
      .digest('base64url');

    if (signature !== expectedSig) return { valid: false };

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    if ((payload.role !== 'admin' && payload.role !== 'lead_admin') || payload.exp < Date.now()) {
      return { valid: false };
    }

    const isLead = isLeadAdminEmail(payload.email) || payload.role === 'lead_admin';
    return {
      valid: true,
      role: isLead ? 'lead_admin' : 'admin',
      email: payload.email,
      userId: payload.userId,
    };
  } catch (e) {
    return { valid: false };
  }
}

/**
 * Verify whether a request is from an authorized admin:
 * 1. Checks for master admin token (from login panel)
 * 2. Checks Supabase Auth token & profiles.role / admin list
 */
export async function verifyAdminRequest(
  req: NextRequest
): Promise<{
  isAdmin: boolean;
  isLeadAdmin: boolean;
  userId: string;
  adminId?: string;
  role: 'lead_admin' | 'admin' | 'user';
  email?: string;
}> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('x-admin-token');
  if (!authHeader) {
    return { isAdmin: false, isLeadAdmin: false, userId: '', role: 'user' };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  // 1. Check Master Admin Token
  const masterCheck = verifyMasterAdminToken(token);
  if (masterCheck.valid && masterCheck.role) {
    const isLead = masterCheck.role === 'lead_admin' || isLeadAdminEmail(masterCheck.email);
    return {
      isAdmin: true,
      isLeadAdmin: isLead,
      userId: masterCheck.userId || 'admin-master-root',
      adminId: masterCheck.userId || 'admin-master-root',
      role: isLead ? 'lead_admin' : 'admin',
      email: masterCheck.email || LEAD_ADMIN_EMAIL,
    };
  }

  // 2. Check Supabase User Token
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser(token);

      if (!authErr && user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, full_name, role')
          .eq('id', user.id)
          .maybeSingle();

        const userEmail = user.email?.toLowerCase();
        const isLead = isLeadAdminEmail(userEmail) || profile?.role === 'lead_admin';
        const isEmailAdmin = isUserAdminEmail(userEmail);
        const isAdmin = isLead || profile?.role === 'admin' || isEmailAdmin;

        const resolvedRole: 'lead_admin' | 'admin' | 'user' = isLead
          ? 'lead_admin'
          : isAdmin
          ? 'admin'
          : 'user';

        return {
          isAdmin,
          isLeadAdmin: isLead,
          userId: user.id,
          adminId: user.id,
          role: resolvedRole,
          email: user.email,
        };
      }
    } catch (e) {}
  }

  return { isAdmin: false, isLeadAdmin: false, userId: '', role: 'user' };
}

export interface AdminAuditRecord {
  id: string;
  admin_id?: string;
  admin_email?: string;
  action: string;
  target_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

const AUDIT_LOG_STORE_PATH = path.resolve(process.cwd(), '.workspaces', 'data', 'admin_audit_logs.json');
const SUSPENSIONS_STORE_PATH = path.resolve(process.cwd(), '.workspaces', 'data', 'suspended_users.json');

function loadAuditLogsDisk(): AdminAuditRecord[] {
  try {
    if (fs.existsSync(AUDIT_LOG_STORE_PATH)) {
      const raw = fs.readFileSync(AUDIT_LOG_STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveAuditLogsDisk(logs: AdminAuditRecord[]): void {
  try {
    const dir = path.dirname(AUDIT_LOG_STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(AUDIT_LOG_STORE_PATH, JSON.stringify(logs.slice(0, 2000), null, 2), 'utf8');
  } catch (e) {
    console.error('[AdminAudit] Failed to save logs to disk:', e);
  }
}

export async function logAdminAuditAction(entry: {
  adminId?: string;
  adminEmail?: string;
  action: string;
  targetId?: string;
  metadata?: Record<string, any>;
}): Promise<AdminAuditRecord> {
  const record: AdminAuditRecord = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    admin_id: entry.adminId || 'admin-root',
    admin_email: entry.adminEmail || LEAD_ADMIN_EMAIL,
    action: entry.action,
    target_id: entry.targetId,
    metadata: entry.metadata || {},
    created_at: new Date().toISOString(),
  };

  // 1. Save to disk
  const list = loadAuditLogsDisk();
  list.unshift(record);
  saveAuditLogsDisk(list);

  // 2. Try Supabase
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      await supabase.from('admin_audit_logs').insert({
        admin_id: entry.adminId?.startsWith('admin-') ? null : entry.adminId,
        action: entry.action,
        target_id: entry.targetId,
        metadata: {
          ...entry.metadata,
          admin_email: entry.adminEmail,
        },
        created_at: record.created_at,
      });
    } catch {}
  }

  return record;
}

export async function getAdminAuditLogsList(limit: number = 100): Promise<AdminAuditRecord[]> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!error && data && data.length > 0) {
        return data.map((d) => ({
          id: d.id,
          admin_id: d.admin_id,
          admin_email: d.metadata?.admin_email || d.admin_id || 'admin',
          action: d.action,
          target_id: d.target_id,
          metadata: d.metadata,
          created_at: d.created_at,
        }));
      }
    } catch {}
  }
  return loadAuditLogsDisk().slice(0, limit);
}

// User Suspensions Management
export interface SuspensionRecord {
  user_id: string;
  reason: string;
  suspended_by: string;
  suspended_at: string;
}

function loadSuspensions(): SuspensionRecord[] {
  try {
    if (fs.existsSync(SUSPENSIONS_STORE_PATH)) {
      const raw = fs.readFileSync(SUSPENSIONS_STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveSuspensions(list: SuspensionRecord[]): void {
  try {
    const dir = path.dirname(SUSPENSIONS_STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SUSPENSIONS_STORE_PATH, JSON.stringify(list, null, 2), 'utf8');
  } catch {}
}

export async function suspendUserAccount(userId: string, reason: string = 'Violation of platform terms', adminEmail: string = LEAD_ADMIN_EMAIL): Promise<boolean> {
  const current = loadSuspensions();
  const existing = current.find((s) => s.user_id === userId);
  const record: SuspensionRecord = {
    user_id: userId,
    reason,
    suspended_by: adminEmail,
    suspended_at: new Date().toISOString(),
  };

  if (existing) {
    Object.assign(existing, record);
  } else {
    current.push(record);
  }
  saveSuspensions(current);

  // Sync to profiles table preferences
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      await supabase
        .from('profiles')
        .update({
          preferences: { suspended: true, suspended_at: record.suspended_at, suspended_reason: reason },
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    } catch {}
  }

  await logAdminAuditAction({
    adminEmail,
    action: 'suspend_user',
    targetId: userId,
    metadata: { reason },
  });

  return true;
}

export async function restoreUserAccount(userId: string, adminEmail: string = LEAD_ADMIN_EMAIL): Promise<boolean> {
  const current = loadSuspensions().filter((s) => s.user_id !== userId);
  saveSuspensions(current);

  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      await supabase
        .from('profiles')
        .update({
          preferences: { suspended: false, restored_at: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    } catch {}
  }

  await logAdminAuditAction({
    adminEmail,
    action: 'restore_user',
    targetId: userId,
  });

  return true;
}

export function isUserSuspended(userId?: string | null): boolean {
  if (!userId) return false;
  const list = loadSuspensions();
  return list.some((s) => s.user_id === userId);
}

export function getSuspendedUsersList(): SuspensionRecord[] {
  return loadSuspensions();
}

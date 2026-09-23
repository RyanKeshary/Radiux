import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@radiux.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123456';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'radiux-master-admin-secret-key-2026';

export const ADMIN_CONFIG = {
  email: ADMIN_EMAIL,
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

  const isEmailMatch = cleanId === ADMIN_EMAIL.toLowerCase();
  const isUsernameMatch = cleanId === 'admin';
  const isPassMatch = cleanPass === ADMIN_PASSWORD;

  return (isEmailMatch || isUsernameMatch) && isPassMatch;
}

/**
 * Generate a signed tamper-proof admin token valid for 7 days
 */
export function generateAdminToken(): string {
  const payload = {
    role: 'admin',
    email: ADMIN_EMAIL,
    userId: 'admin-master-root',
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
export function verifyMasterAdminToken(token: string): boolean {
  if (!token || !token.startsWith('rad_adm.')) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const [, payloadBase64, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', ADMIN_SECRET)
      .update(payloadBase64)
      .digest('base64url');

    if (signature !== expectedSig) return false;

    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    if (payload.role !== 'admin' || payload.exp < Date.now()) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Verify whether a request is from an authorized admin:
 * 1. Checks for master admin token (from login panel)
 * 2. Checks Supabase Auth token & profiles.role === 'admin'
 */
export async function verifyAdminRequest(
  req: NextRequest
): Promise<{ isAdmin: boolean; userId: string; adminId?: string; role: string; email?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { isAdmin: false, userId: '', role: '' };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  // 1. Check Master Admin Token
  if (verifyMasterAdminToken(token)) {
    return {
      isAdmin: true,
      userId: 'admin-master-root',
      adminId: 'admin-master-root',
      role: 'admin',
      email: ADMIN_EMAIL,
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

        const isAdmin = profile?.role === 'admin';
        return {
          isAdmin,
          userId: user.id,
          adminId: user.id,
          role: profile?.role || 'user',
          email: user.email,
        };
      }
    } catch (e) {}
  }

  return { isAdmin: false, userId: '', role: '' };
}

export const LEAD_ADMIN_EMAIL = 'kesharyryan@gmail.com';

export function isUserAdmin(user?: any | null): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'lead_admin') return true;
  const email = user.email?.trim().toLowerCase();
  if (!email) return false;
  if (email === LEAD_ADMIN_EMAIL.toLowerCase()) return true;
  if (email === 'admin@radiux.internal' || email === 'admin@codecollab.io') return true;
  return false;
}

export function isUserAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  if (clean === LEAD_ADMIN_EMAIL.toLowerCase()) return true;
  if (clean === 'admin@radiux.internal' || clean === 'admin@codecollab.io') return true;
  return false;
}

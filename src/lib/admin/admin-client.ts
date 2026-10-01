export const LEAD_ADMIN_EMAIL = 'ryankeshary@gmail.com';

export function isUserAdmin(user?: any | null): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'lead_admin') return true;
  const email = user.email?.trim().toLowerCase();
  if (!email) return false;
  if (email === LEAD_ADMIN_EMAIL.toLowerCase()) return true;
  return false;
}

export function isUserAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  if (clean === LEAD_ADMIN_EMAIL.toLowerCase()) return true;
  return false;
}

import { supabaseAdmin } from './supabase.js';

export const PERMISSIONS = [
  'view_overview','view_members','manage_members','manage_memberships','view_mentors','manage_mentors','approve_mentors',
  'manage_invitations','view_mentorship_requests','view_applications','manage_applications','manage_matches','manage_sessions','manage_donations','manage_submissions','manage_content','manage_email_queue',
  'view_reports','manage_staff','assign_roles','assign_permissions','manage_settings','manage_payments','view_audit'
] as const;

export type Permission = typeof PERMISSIONS[number];
export type PermissionMode = 'additive' | 'replace';

export interface AccessContext {
  isStaff: boolean;
  isSuperAdmin: boolean;
  staffStatus: 'invited'|'active'|'suspended'|'deactivated'|null;
  roleKey: string | null;
  permissionMode: PermissionMode | null;
  permissions: string[];
  mentorStatus: string | null;
  mentorActive: boolean;
}

export async function loadAccessContext(userId: string): Promise<AccessContext> {
  const [{ data: staff, error: staffError }, { data: mentor, error: mentorError }] = await Promise.all([
    supabaseAdmin
      .from('staff_memberships')
      .select('status,role_key,permission_mode,custom_permissions,role:staff_roles!staff_memberships_role_key_fkey(permissions,is_super_admin)')
      .eq('user_id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('mentor_profiles')
      .select('profile_status,is_active')
      .eq('user_id', userId)
      .maybeSingle()
  ]);

  if (staffError) throw staffError;
  if (mentorError) throw mentorError;

  const role = staff?.role as unknown as { permissions?: string[]; is_super_admin?: boolean } | null;
  const active = staff?.status === 'active';
  const permissionMode = (staff?.permission_mode as PermissionMode | null) ?? 'additive';
  const rolePermissions = role?.permissions ?? [];
  const customPermissions = (staff?.custom_permissions as string[] | null) ?? [];
  const isSuperAdmin = active && Boolean(role?.is_super_admin);
  const permissions = !active
    ? []
    : isSuperAdmin
      ? ['*']
      : permissionMode === 'replace'
        ? Array.from(new Set(customPermissions))
        : Array.from(new Set([...rolePermissions, ...customPermissions]));

  return {
    isStaff: Boolean(staff),
    isSuperAdmin,
    staffStatus: (staff?.status as AccessContext['staffStatus']) ?? null,
    roleKey: staff?.role_key ?? null,
    permissionMode: staff ? permissionMode : null,
    permissions,
    mentorStatus: mentor?.profile_status ?? null,
    mentorActive: Boolean(mentor?.is_active)
  };
}

export function can(context: AccessContext | undefined, permission: Permission): boolean {
  if (!context || context.staffStatus !== 'active') return false;
  return context.isSuperAdmin || context.permissions.includes('*') || context.permissions.includes(permission);
}

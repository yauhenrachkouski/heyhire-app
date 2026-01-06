/**
 * Role-based access control (RBAC) system
 *
 * Roles hierarchy (highest to lowest):
 * - owner: Full control, can delete org
 * - admin: Manage members, billing, settings
 * - member: Create searches, contact candidates
 * - viewer: Read-only access (invited viewers)
 * - demo_viewer: Anonymous demo users (read-only)
 */

export const ROLES = {
  owner: "owner",
  admin: "admin",
  member: "member",
  viewer: "viewer",
  demo_viewer: "demo_viewer",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Roles that can manage organization settings */
export const ADMIN_ROLES = new Set<string>(["owner", "admin"]);

/** Roles that can create/modify content */
export const EDITOR_ROLES = new Set<string>(["owner", "admin", "member"]);

/** All valid roles including read-only */
export const ALL_ROLES = new Set<string>(Object.values(ROLES));

/** Read-only roles */
export const READONLY_ROLES = new Set<string>(["viewer", "demo_viewer"]);

/**
 * Permission definitions
 * Maps permission names to the roles that have them
 */
export const PERMISSIONS: Record<string, readonly Role[]> = {
  // Search permissions
  search_create: ["owner", "admin", "member"],
  search_view: ["owner", "admin", "member", "viewer", "demo_viewer"],
  search_edit: ["owner", "admin", "member"],
  search_delete: ["owner", "admin"],

  // Candidate permissions
  candidate_view: ["owner", "admin", "member", "viewer", "demo_viewer"],
  candidate_contact: ["owner", "admin", "member"],
  candidate_status_update: ["owner", "admin", "member"],
  candidate_notes: ["owner", "admin", "member"],

  // Organization permissions
  org_settings: ["owner", "admin"],
  org_delete: ["owner"],

  // Member permissions
  members_view: ["owner", "admin", "member", "viewer"],
  members_invite: ["owner", "admin"],
  members_remove: ["owner", "admin"],
  members_role_change: ["owner", "admin"],

  // Billing permissions
  billing_view: ["owner", "admin"],
  billing_manage: ["owner", "admin"],

  // Share link permissions
  share_links_create: ["owner", "admin"],
  share_links_revoke: ["owner", "admin"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: string | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const allowedRoles = PERMISSIONS[permission];
  return allowedRoles?.includes(role as Role) ?? false;
}

/**
 * Check if a role is read-only
 */
export function isReadOnlyRole(role: string | null | undefined): boolean {
  if (!role) return true;
  return READONLY_ROLES.has(role);
}

/**
 * Check if a role is an admin role
 */
export function isAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return ADMIN_ROLES.has(role);
}

/**
 * Check if a role can edit content
 */
export function canEdit(role: string | null | undefined): boolean {
  if (!role) return false;
  return EDITOR_ROLES.has(role);
}

/**
 * Get display label for a role
 */
export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    owner: "Owner",
    admin: "Admin",
    member: "Member",
    viewer: "Viewer",
    demo_viewer: "Demo",
  };
  return labels[role] ?? role;
}

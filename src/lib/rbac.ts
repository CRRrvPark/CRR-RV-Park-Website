/**
 * Role-Based Access Control — single source of truth for who can do what.
 *
 * Read this with the role table from RUNBOOK.md (Section: User Roles).
 *
 * Public-page code changes flow through Netlify Agent Runners, Deploy
 * Previews, and GitHub review. This matrix covers the operational admin only.
 */

export type UserRole = 'owner' | 'editor' | 'contributor' | 'viewer';

const ROLE_ORDER: Record<UserRole, number> = {
  viewer: 0,
  contributor: 1,
  editor: 2,
  owner: 3,
};

export function isRoleAtLeast(actual: UserRole | null | undefined, required: UserRole): boolean {
  if (!actual) return false;
  return ROLE_ORDER[actual] >= ROLE_ORDER[required];
}

/**
 * Capability matrix. Each capability maps to the minimum role required.
 * To change permissions, change here — every gate in the app uses this.
 */
export const CAPABILITY: Record<string, UserRole> = {
  // Media
  view_media: 'viewer',
  upload_media: 'contributor',
  delete_media: 'editor',

  // Events
  view_events: 'viewer',
  edit_events: 'editor',
  hide_synced_event: 'editor',

  // Area guide — trails, things-to-do, local places, park sites
  view_area_guide: 'viewer',
  manage_area_guide: 'editor',

  // Users + roles
  view_users: 'viewer',
  invite_user: 'owner',
  change_user_role: 'owner',
  remove_user: 'owner',

  // System
  view_audit_log: 'viewer',
  manage_zoho_integration: 'owner',
  view_runbook: 'viewer',
  edit_runbook: 'owner',
};

export type Capability = keyof typeof CAPABILITY;

export function can(role: UserRole | null | undefined, capability: Capability): boolean {
  return isRoleAtLeast(role, CAPABILITY[capability]);
}

/** Throws a 403-equivalent if the user lacks the capability. */
export function requireCapability(role: UserRole | null | undefined, capability: Capability): void {
  if (!can(role, capability)) {
    throw new ForbiddenError(`This action requires role: ${CAPABILITY[capability]} (your role: ${role ?? 'unauthenticated'})`);
  }
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: 'Full operational control. Can manage users, integrations, media, events, area-guide records, and the runbook. Keep at least 2 active owners.',
  editor: 'Manage operational website data, including media, events, area-guide records, and park-map details. Cannot manage users.',
  contributor: 'Can upload media and view operational records. Public-page changes use Netlify Agent Runners and Git review.',
  viewer: 'Read-only access to admin. Useful for board members who want visibility without edit risk.',
};

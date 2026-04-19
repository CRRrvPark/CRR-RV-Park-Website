/**
 * Role-Based Access Control — single source of truth for who can do what.
 *
 * Read this with the role table from RUNBOOK.md (Section: User Roles).
 *
 * Patterns:
 *   if (!can(user, 'publish_content')) return forbidden();
 *   if (!isRoleAtLeast(user.role, 'editor')) return forbidden();
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
  // Content
  view_content: 'viewer',
  edit_content_draft: 'contributor',
  edit_content_direct: 'editor',
  approve_content_draft: 'editor',
  publish_content: 'editor',
  delete_page: 'owner',

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

  // Code editor (DANGEROUS — owner only)
  view_code: 'owner',
  edit_code: 'owner',
  publish_code: 'owner',

  // Users + roles
  view_users: 'viewer',
  invite_user: 'owner',
  change_user_role: 'owner',
  remove_user: 'owner',

  // System
  view_audit_log: 'viewer',
  view_snapshots: 'viewer',
  restore_snapshot: 'editor',
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
  owner: 'Full control. Can edit code, manage users, change billing, restore snapshots. There must always be at least 2 active owners.',
  editor: 'Edit any content + publish to live site. Approve contributor drafts. Cannot edit code or manage users.',
  contributor: 'Draft content edits for review. Drafts are held until an editor or owner approves them. Cannot publish directly.',
  viewer: 'Read-only access to admin. Useful for board members who want visibility without edit risk.',
};

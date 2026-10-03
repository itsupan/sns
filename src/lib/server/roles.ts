import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements } from 'better-auth/plugins/admin/access';

export const ROLES = ['user', 'moderator', 'admin'] as const;
export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = { user: 0, moderator: 1, admin: 2 };

export const accessControl = createAccessControl(defaultStatements);
const noPermissions = accessControl.newRole({ user: [], session: [] });

/**
 * Roles for better-auth's admin plugin. None holds a plugin permission, so every plugin endpoint
 * (ban, delete, impersonate, set-password, set-role, ...) answers 403: those skip our rank check
 * and audit trail, and moderation goes through `/api/admin` instead.
 */
export const pluginRoles = { user: noPermissions, moderator: noPermissions, admin: noPermissions };

/** A user's role; null (accounts created before roles existed) or anything unknown is `user`. */
export function roleOf(user: { role?: string | null }): Role {
	return ROLES.find((role) => role === user.role) ?? 'user';
}

export const isModerator = (user: { role?: string | null }) => RANK[roleOf(user)] >= RANK.moderator;

export const isAdmin = (user: { role?: string | null }) => roleOf(user) === 'admin';

/** Only a higher role may act on a user, so moderators cannot act on moderators or admins. */
export const outranks = (actor: { role?: string | null }, target: { role?: string | null }) =>
	RANK[roleOf(actor)] > RANK[roleOf(target)];

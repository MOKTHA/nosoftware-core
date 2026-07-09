import { z } from 'zod';

/**
 * Organization schema — a top-level tenant boundary.
 *
 * Organizations group workspaces and users; data isolation flows from here.
 * Every entity in the control plane is scoped, directly or transitively,
 * to an organization.
 *
 * Design notes:
 * - Named uniquely by slug within the deployment (for URLs and display).
 * - Plan/billing fields intentionally deferred — the schema can extend
 *   later without breaking existing consumers.
 * - Multi-tenancy model assumes each organization has completely isolated
 *   data; cross-organization queries are forbidden at the application layer
 *   (see future ADR on tenant isolation).
 */

export const OrganizationId = z.string().uuid();

/** Slug: lowercase, no spaces, 2-48 chars. */
export const OrganizationSlug = z
  .string()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
    message:
      'slug must be lowercase, 2-48 chars, start/end with letter or digit, hyphens allowed in the middle',
  });

export const OrganizationStatus = z.enum(['active', 'suspended', 'deleted']);

export const Organization = z.object({
  id: OrganizationId,
  name: z.string().min(1).max(200),
  slug: OrganizationSlug,
  status: OrganizationStatus.default('active'),

  // Optional owner link; a user who created the org
  // (kept as nullable to support bootstrap cases where the creator is
  // assigned after org creation).
  ownerId: z.string().uuid().nullish(),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Organization = z.infer<typeof Organization>;
export type OrganizationId = z.infer<typeof OrganizationId>;
export type OrganizationSlug = z.infer<typeof OrganizationSlug>;
export type OrganizationStatus = z.infer<typeof OrganizationStatus>;

/**
 * Subset used when embedding orgs in audit trails, nested responses, or UI lists.
 */
export const OrganizationSummary = Organization.pick({
  id: true,
  name: true,
  slug: true,
  status: true,
});

export type OrganizationSummary = z.infer<typeof OrganizationSummary>;

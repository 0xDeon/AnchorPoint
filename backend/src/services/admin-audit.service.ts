import prisma from '../lib/prisma';
import logger from '../utils/logger';

/**
 * Actions captured in the admin configuration audit trail.
 */
export type AdminAuditAction =
  | 'CONFIG_UPDATE'
  | 'CONFIG_UI_UPDATE'
  | 'CONFIG_ROLLBACK';

/**
 * Information about the administrator (or automated actor) responsible for a
 * privileged configuration change. Populated from the authenticated request
 * where available.
 */
export interface AuditActor {
  id?: string | null;
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface RecordConfigChangeParams {
  action: AdminAuditAction;
  actor?: AuditActor;
  configVersion?: number | null;
  previousVersion?: number | null;
  /** Previous config object, used to compute a field-level diff. */
  before?: Record<string, unknown> | null;
  /** New config object, used to compute a field-level diff. */
  after?: Record<string, unknown> | null;
  /** Arbitrary extra context to persist alongside the entry. */
  metadata?: Record<string, unknown> | null;
}

export interface AuditLogQuery {
  action?: AdminAuditAction;
  actorId?: string;
  limit?: number;
  offset?: number;
}

type FieldDiff = Record<string, { before: unknown; after: unknown }>;

/**
 * Computes a shallow, top-level diff between two configuration objects.
 * Returns the changed keys and a `{ before, after }` map for each of them.
 */
export function computeConfigDiff(
  before?: Record<string, unknown> | null,
  after?: Record<string, unknown> | null
): { changedKeys: string[]; diff: FieldDiff } {
  const diff: FieldDiff = {};

  if (!before && !after) {
    return { changedKeys: [], diff };
  }

  const keys = new Set<string>([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);

  for (const key of keys) {
    const prevValue = before?.[key];
    const nextValue = after?.[key];

    // Compare by structural equality; JSON stringify is sufficient for the
    // plain-object configuration payloads handled here.
    if (JSON.stringify(prevValue) !== JSON.stringify(nextValue)) {
      diff[key] = { before: prevValue, after: nextValue };
    }
  }

  return { changedKeys: Object.keys(diff), diff };
}

/**
 * Records and queries the admin configuration audit trail.
 *
 * Recording is intentionally best-effort: an audit write must never block or
 * fail the underlying configuration change, so failures are logged and
 * swallowed rather than propagated.
 */
export class AdminAuditService {
  async recordConfigChange(params: RecordConfigChangeParams): Promise<void> {
    try {
      const { changedKeys, diff } = computeConfigDiff(params.before, params.after);

      await prisma.adminConfigAuditLog.create({
        data: {
          action: params.action,
          actorId: params.actor?.id ?? null,
          actorEmail: params.actor?.email ?? null,
          actorIp: params.actor?.ip ?? null,
          userAgent: params.actor?.userAgent ?? null,
          configVersion: params.configVersion ?? null,
          previousVersion: params.previousVersion ?? null,
          changedKeys: changedKeys.length > 0 ? JSON.stringify(changedKeys) : null,
          diff: Object.keys(diff).length > 0 ? JSON.stringify(diff) : null,
          metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        },
      });

      logger.info('Recorded admin config audit entry', {
        action: params.action,
        actorId: params.actor?.id ?? undefined,
        configVersion: params.configVersion ?? undefined,
        changedKeys,
      });
    } catch (error) {
      // Never let auditing break the primary operation.
      logger.error('Failed to record admin config audit entry', {
        action: params.action,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async listAuditLogs(query: AuditLogQuery = {}) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);

    const where: Record<string, unknown> = {};
    if (query.action) {
      where.action = query.action;
    }
    if (query.actorId) {
      where.actorId = query.actorId;
    }

    const [rows, total] = await Promise.all([
      prisma.adminConfigAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.adminConfigAuditLog.count({ where }),
    ]);

    const entries = rows.map((row) => ({
      ...row,
      changedKeys: safeJsonParse(row.changedKeys),
      diff: safeJsonParse(row.diff),
      metadata: safeJsonParse(row.metadata),
    }));

    return { entries, total, limit, offset };
  }
}

function safeJsonParse(value: string | null): unknown {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export const adminAuditService = new AdminAuditService();
export default adminAuditService;

import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth/session";

/**
 * Append-only audit trail (#6 improvement).
 *
 * Fire-and-forget by design: audit failures must NEVER break the business
 * operation being audited. Call this at security-relevant decision points:
 * auth events, role/user changes, financial mutations, settings changes,
 * bulk/destructive operations.
 *
 * Usage:
 *   await audit(session, req, "payment.process", "Payment", payment.id, {
 *     amount, invoiceNumber,
 *   });
 */

export type AuditAction =
  // auth
  | "login.success"
  | "login.failure"
  | "logout"
  | "password.reset_requested"
  | "password.changed"
  | "email.verified"
  | "session.revoked_all"
  // users & roles
  | "user.approved"
  | "user.deactivated"
  | "user.deleted"
  | "user.removed_from_org"
  | "member.role_changed"
  | "permissions.updated"
  // billing
  | "billing.plan_selected"
  | "billing.payment_proof_submitted"
  | "billing.payment_proof_approved"
  | "billing.payment_proof_rejected"
  // accounting / logistics mutations
  | "payment.processed"
  | "payment.deleted"
  | "invoice.created"
  | "invoice.updated"
  | "invoice.deleted"
  | "credit_note.created"
  | "debit_note.created"
  | "journal_entry.created"
  | "period.closed"
  | "shipment.created"
  | "shipment.updated"
  | "shipment.deleted"
  | "customer.deleted"
  | "vendor.deleted"
  // files
  | "file.uploaded"
  | "file.deleted";

export async function audit(
  actor: Pick<SessionPayload, "userId" | "email" | "organizationId"> | null,
  req: Request | null,
  action: AuditAction,
  entityType?: string,
  entityId?: string | number | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: actor?.organizationId ?? null,
        actorUserId: actor?.userId ?? null,
        actorEmail: actor?.email ?? null,
        action,
        entityType: entityType ?? null,
        entityId: entityId != null ? String(entityId) : null,
        metadata: (metadata ?? undefined) as never,
        ipAddress:
          req?.headers.get("x-real-ip") ||
          req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          null,
        userAgent: req?.headers.get("user-agent")?.slice(0, 300) || null,
      },
    });
  } catch (err) {
    // Never let audit failures break the request — but make them visible.
    console.error("[audit] failed to record:", action, err);
  }
}

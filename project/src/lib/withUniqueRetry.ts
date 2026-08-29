/**
 * Retry helper for unique-constraint races on generated document numbers.
 *
 * Atomic OrgSequence counters make collisions rare, but concurrent creates
 * can still interleave between number reservation and row insert. Catching
 * P2002 and regenerating once closes that window.
 *
 * Usage:
 *   const shipment = await withUniqueRetry(() =>
 *     prisma.shipment.create({ data: { ...data, invoiceNumber } })
 *   );
 */

export function isUniqueViolation(e: unknown): boolean {
  if (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  ) {
    const meta = (e as { meta?: { target?: string | string[] } }).meta;
    const target = Array.isArray(meta?.target)
      ? meta?.target.join(",")
      : String(meta?.target || "");
    // User-entered trackingId or referenceNumber collisions cannot be resolved by retry
    if (target.includes("trackingId") || target.includes("referenceNumber")) {
      return false;
    }
    return true;
  }
  return false;
}

export async function withUniqueRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; onRetry?: () => Promise<void> | void } = {}
): Promise<T> {
  const max = Math.max(1, opts.retries ?? 2);
  let lastError: unknown;

  for (let attempt = 0; attempt <= max; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isUniqueViolation(e) || attempt === max) throw e;
      lastError = e;
      await opts.onRetry?.();
    }
  }
  throw lastError;
}

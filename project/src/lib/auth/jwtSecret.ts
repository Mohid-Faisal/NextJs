/**
 * SECURITY: Never fall back to a default secret. A missing JWT_SECRET must
 * fail closed (throw) rather than silently signing tokens with a publicly
 * known constant that allows full token forgery.
 *
 * Kept in its own module (no next/headers, no Prisma) so that shared code
 * imported by client components (e.g. lib/utils.ts) can depend on it without
 * pulling server-only APIs into the client bundle.
 */
export function getJwtSecretString(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "your-secret-key") {
    throw new Error(
      "JWT_SECRET is not configured. Set a strong random JWT_SECRET environment variable."
    );
  }
  return secret;
}

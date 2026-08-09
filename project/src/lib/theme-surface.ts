/**
 * True when className forces a light `bg-white` without a `dark:bg-*`
 * companion. Callers that do this strip theme `bg-card` / input surfaces
 * while leaving dark-mode foreground tokens — light text on white.
 */
export function needsThemeSurfaceGuard(
  className?: string | null
): boolean {
  if (!className) return false;
  if (/\bdark:bg-/.test(className)) return false;
  return /\bbg-white(?:\/[\w.]+)?\b/.test(className);
}

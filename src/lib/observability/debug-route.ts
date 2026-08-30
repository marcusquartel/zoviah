/**
 * Gate for `/api/debug-sentry`. Pure so it is unit-testable.
 *
 * The route deliberately throws to test error monitoring. In production that is
 * an abuse vector (anyone could burn Sentry quota), so it is off there unless
 * `ENABLE_SENTRY_DEBUG_ROUTE=1` is explicitly set. Anywhere else it is on.
 */
export function isDebugRouteEnabled(env: {
  NODE_ENV?: string;
  ENABLE_SENTRY_DEBUG_ROUTE?: string;
}): boolean {
  if (env.NODE_ENV !== "production") return true;
  return env.ENABLE_SENTRY_DEBUG_ROUTE === "1";
}

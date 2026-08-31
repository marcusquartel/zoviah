import { cache } from "react";
import { headers } from "next/headers";
import {
  deriveRootDomain,
  resolveHostContext,
  type HostContext,
} from "@/lib/tenant/host";

/** The platform's base domain for the running app. */
export function getRootDomain(): string {
  return deriveRootDomain(process.env);
}

/** Absolute URL on the ROOT domain (used to bounce /admin off a tenant host). */
export function rootUrl(path: string): string {
  const rel = path.startsWith("/") ? path : `/${path}`;
  return `https://${getRootDomain()}${rel}`;
}

/**
 * The tenant context for the current request, from the `Host` header.
 * `cache()`d so every caller in a render shares one `headers()` read.
 */
export const getHostContext = cache(async (): Promise<HostContext> => {
  const h = await headers();
  return resolveHostContext(h.get("host"), getRootDomain());
});

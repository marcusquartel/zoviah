// Every portal route is per-user (auth), never static.
export const dynamic = "force-dynamic";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh bg-surface">{children}</div>;
}

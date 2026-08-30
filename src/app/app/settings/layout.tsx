import { SettingsNav } from "@/app/app/settings/settings-nav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <SettingsNav />
      {children}
    </div>
  );
}

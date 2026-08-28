import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { isPlausibleHandle, socialProfileUrl } from "@/lib/normalize";
import { formatFollowers } from "@/features/creators/format";
import type { CreatorSocialProfile } from "@/types/database";

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitch: "Twitch",
  kwai: "Kwai",
  x: "X",
  facebook: "Facebook",
  other: "Outro",
};

export function SocialsTab({ socials }: { socials: CreatorSocialProfile[] }) {
  if (socials.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhuma rede informada.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {socials.map((s) => {
        // Only trust a canonical URL; never render a raw submitted string.
        const safeUrl =
          s.platform === "instagram" || s.platform === "tiktok"
            ? socialProfileUrl(s.platform, s.handle_normalized)
            : null;
        const suspect =
          (s.platform === "instagram" || s.platform === "tiktok") &&
          !isPlausibleHandle(s.handle_normalized, s.platform);

        return (
          <div key={s.id} className="rounded-lg border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {PLATFORM_LABELS[s.platform] ?? s.platform}
              </span>
              {safeUrl ? (
                <Link
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Abrir perfil <ExternalLink className="size-3" />
                </Link>
              ) : null}
            </div>
            <p className="mt-1">@{s.handle_normalized}</p>
            {suspect ? (
              <p className="mt-1 text-xs text-warning-foreground">
                Handle fora do padrão da plataforma — confirmar manualmente.
              </p>
            ) : null}
            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
              <span>
                Seguidores: {formatFollowers(s.followers_declared)}
              </span>
              <span>
                Views médias: {formatFollowers(s.average_views_declared)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

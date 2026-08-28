import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ApplicationStatusBadge } from "@/features/applications/status-badge";
import { ApplicationActions } from "@/features/creators/components/application-actions";
import { DuplicateWarning } from "@/features/creators/components/duplicate-warning";
import { FieldRow } from "@/features/creators/components/drawer/field-row";
import { formatDate, formatFollowers } from "@/features/creators/format";
import type { ApplicationDetail } from "@/features/creators/queries";

export function SummaryTab({
  detail,
  onChanged,
}: {
  detail: ApplicationDetail;
  onChanged: () => void;
}) {
  const { application, program, creator, socials, otherApplications } = detail;
  const ig = socials.find((s) => s.platform === "instagram");
  const tt = socials.find((s) => s.platform === "tiktok");

  return (
    <div className="space-y-5">
      {application.possible_duplicate ? <DuplicateWarning /> : null}

      <div className="flex flex-wrap items-center gap-2">
        <ApplicationStatusBadge status={application.status} />
        <span className="text-sm text-muted-foreground">
          {program.name} · inscrição de {formatDate(application.submitted_at)}
        </span>
      </div>

      <ApplicationActions
        applicationId={application.id}
        status={application.status}
        onDone={onChanged}
      />

      <dl className="divide-y">
        <FieldRow label="Nome" value={creator.full_name} />
        <FieldRow label="Prefere" value={creator.preferred_name} />
        <FieldRow
          label="Local"
          value={
            [creator.city, creator.state].filter(Boolean).join(" / ") || null
          }
        />
        <FieldRow
          label="Instagram"
          value={
            ig ? (
              <SocialLine
                handle={ig.handle_normalized}
                url={ig.profile_url}
                followers={ig.followers_declared}
              />
            ) : null
          }
        />
        <FieldRow
          label="TikTok"
          value={
            tt ? (
              <SocialLine
                handle={tt.handle_normalized}
                url={tt.profile_url}
                followers={tt.followers_declared}
              />
            ) : null
          }
        />
      </dl>

      {otherApplications.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Outras inscrições desta creator
          </p>
          <ul className="space-y-1 text-sm">
            {otherApplications.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5"
              >
                <span className="truncate">{o.program_name}</span>
                <ApplicationStatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SocialLine({
  handle,
  url,
  followers,
}: {
  handle: string;
  url: string | null;
  followers: number | null;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {url ? (
        <Link
          href={url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-primary hover:underline"
        >
          @{handle} <ExternalLink className="inline size-3" />
        </Link>
      ) : (
        <span>@{handle}</span>
      )}
      {followers != null ? (
        <span className="text-muted-foreground">
          · {formatFollowers(followers)} seguidores
        </span>
      ) : null}
    </span>
  );
}

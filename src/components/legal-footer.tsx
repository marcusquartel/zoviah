import { getLegalLinks } from "@/lib/legal";

/** Terms / Privacy links on public pages — rendered only when configured. */
export function LegalFooter({ className }: { className?: string }) {
  const { privacyUrl, termsUrl } = getLegalLinks();
  if (!privacyUrl && !termsUrl) return null;

  return (
    <p className={className ?? "mt-6 text-center text-xs text-muted-foreground"}>
      {termsUrl ? (
        <a
          href={termsUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="hover:underline"
        >
          Termos
        </a>
      ) : null}
      {termsUrl && privacyUrl ? " · " : null}
      {privacyUrl ? (
        <a
          href={privacyUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="hover:underline"
        >
          Privacidade
        </a>
      ) : null}
    </p>
  );
}

import { parseArticle } from "@/features/support/article-format";

/** Renders a plain-text help-article body (paragraphs + `-` / `N.` lists). */
export function ArticleBody({ content }: { content: string }) {
  const blocks = parseArticle(content);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground">
      {blocks.map((b, i) => {
        if (b.kind === "p") return <p key={i}>{b.text}</p>;
        if (b.kind === "ul")
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {b.items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ul>
          );
        return (
          <ol key={i} className="list-decimal space-y-1 pl-5">
            {b.items.map((it, j) => (
              <li key={j}>{it}</li>
            ))}
          </ol>
        );
      })}
    </div>
  );
}

/**
 * Seed / refresh the knowledge base (Phase 7A).
 *
 *   node scripts/seed-help-articles.mjs           # upsert all articles
 *   node scripts/seed-help-articles.mjs --dry-run # show what would change
 *
 * Idempotent: articles are keyed by `slug` and upserted, so running twice
 * makes no duplicates and only writes rows whose content changed. Slugs in
 * RETIRED_HELP_ARTICLE_SLUGS are archived (status 'archived'), so the help
 * center and the assistant stop citing them. Uses the service role key
 * (bypasses RLS) — run from a trusted environment, never the browser. Safe
 * against production: it only touches `help_articles` and never deletes.
 *
 * Content lives in `scripts/help-articles.mjs`.
 */
import { createClient } from "@supabase/supabase-js";
import { HELP_ARTICLES, RETIRED_HELP_ARTICLE_SLUGS } from "./help-articles.mjs";

process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function normalize(a) {
  return {
    slug: a.slug,
    category: a.category,
    title: a.title,
    summary: a.summary ?? null,
    content: a.content,
    keywords: a.keywords ?? [],
    status: "published",
  };
}

const seen = new Set();
for (const a of HELP_ARTICLES) {
  if (seen.has(a.slug)) {
    console.error(`Duplicate slug in source: ${a.slug}`);
    process.exit(1);
  }
  seen.add(a.slug);
}

const { data: existing, error: readErr } = await db
  .from("help_articles")
  .select("slug, category, title, summary, content, keywords, status");
if (readErr) {
  console.error("Read failed:", readErr.message);
  process.exit(1);
}
const bySlug = new Map((existing ?? []).map((r) => [r.slug, r]));

let created = 0;
let updated = 0;
let unchanged = 0;
const rowsToWrite = [];

for (const article of HELP_ARTICLES) {
  const row = normalize(article);
  const prev = bySlug.get(row.slug);
  if (!prev) {
    created += 1;
    rowsToWrite.push(row);
    continue;
  }
  const same =
    prev.category === row.category &&
    prev.title === row.title &&
    (prev.summary ?? null) === row.summary &&
    prev.content === row.content &&
    prev.status === row.status &&
    JSON.stringify(prev.keywords ?? []) === JSON.stringify(row.keywords);
  if (same) {
    unchanged += 1;
  } else {
    updated += 1;
    rowsToWrite.push(row);
  }
}

const toRetire = RETIRED_HELP_ARTICLE_SLUGS.filter(
  (slug) => bySlug.has(slug) && bySlug.get(slug).status !== "archived",
);

console.log(
  `${HELP_ARTICLES.length} articles in source — ` +
    `${created} new, ${updated} changed, ${unchanged} unchanged, ` +
    `${toRetire.length} to archive.`,
);

if (dryRun) {
  for (const r of rowsToWrite) console.log(`  would write: ${r.slug}`);
  for (const slug of toRetire) console.log(`  would archive: ${slug}`);
  console.log("(dry run — nothing written)");
  process.exit(0);
}

if (toRetire.length > 0) {
  const { error: retireErr } = await db
    .from("help_articles")
    .update({ status: "archived" })
    .in("slug", toRetire);
  if (retireErr) {
    console.error("Archive failed:", retireErr.message);
    process.exit(1);
  }
  console.log(`Archived ${toRetire.length} retired article(s).`);
}

if (rowsToWrite.length === 0) {
  console.log("Nothing to write.");
  process.exit(0);
}

const { error: writeErr } = await db
  .from("help_articles")
  .upsert(rowsToWrite, { onConflict: "slug" });
if (writeErr) {
  console.error("Upsert failed:", writeErr.message);
  process.exit(1);
}
console.log(`Wrote ${rowsToWrite.length} article(s).`);

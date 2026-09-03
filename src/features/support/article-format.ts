/**
 * Help-article bodies are plain text: paragraphs separated by blank lines,
 * `- ` for bullet lists and `N. ` for numbered lists. This turns that into a
 * small block model the renderer can walk. Pure — unit-tested.
 */

export type ArticleBlock =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] };

const BULLET = /^[-*]\s+(.*)$/;
const NUMBERED = /^\d+[.)]\s+(.*)$/;

export function parseArticle(content: string): ArticleBlock[] {
  const lines = (content ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ArticleBlock[] = [];
  let para: string[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: "p", text: para.join(" ").trim() });
      para = [];
    }
  };
  const flushList = () => {
    if (list && list.items.length) blocks.push(list);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") {
      flushPara();
      flushList();
      continue;
    }
    const b = BULLET.exec(line);
    const n = NUMBERED.exec(line);
    if (b) {
      flushPara();
      if (list?.kind !== "ul") {
        flushList();
        list = { kind: "ul", items: [] };
      }
      list.items.push(b[1].trim());
    } else if (n) {
      flushPara();
      if (list?.kind !== "ol") {
        flushList();
        list = { kind: "ol", items: [] };
      }
      list.items.push(n[1].trim());
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

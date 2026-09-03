import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArticle } from "../src/features/support/article-format.ts";

test("parseArticle: paragraphs split on blank lines, soft-wrapped lines joined", () => {
  const blocks = parseArticle(
    "Primeira linha\ncontinua aqui.\n\nSegundo parágrafo.",
  );
  assert.deepEqual(blocks, [
    { kind: "p", text: "Primeira linha continua aqui." },
    { kind: "p", text: "Segundo parágrafo." },
  ]);
});

test("parseArticle: `- ` becomes a bullet list, `N. ` a numbered list", () => {
  const blocks = parseArticle(
    "Passos:\n\n1. Abra Creators.\n2. Clique em Novo.\n\n- item a\n- item b",
  );
  assert.deepEqual(blocks, [
    { kind: "p", text: "Passos:" },
    { kind: "ol", items: ["Abra Creators.", "Clique em Novo."] },
    { kind: "ul", items: ["item a", "item b"] },
  ]);
});

test("parseArticle: a list right after a paragraph (no blank line) still splits", () => {
  const blocks = parseArticle("No menu:\n- Creators\n- Programas\nFim.");
  assert.deepEqual(blocks, [
    { kind: "p", text: "No menu:" },
    { kind: "ul", items: ["Creators", "Programas"] },
    { kind: "p", text: "Fim." },
  ]);
});

test("parseArticle: empty / whitespace content yields no blocks", () => {
  assert.deepEqual(parseArticle(""), []);
  assert.deepEqual(parseArticle("   \n\n  "), []);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCsvTemplate, parseCsv, parseCsvRecords } from "../src/lib/csv.ts";

test("parseCsv: simple rows", () => {
  const rows = parseCsv("a,b,c\n1,2,3\n");
  assert.deepEqual(rows, [
    ["a", "b", "c"],
    ["1", "2", "3"],
  ]);
});

test("parseCsv: quoted field with a comma", () => {
  const rows = parseCsv('name,city\n"Souza, Ana",São Paulo\n');
  assert.deepEqual(rows, [
    ["name", "city"],
    ["Souza, Ana", "São Paulo"],
  ]);
});

test("parseCsv: escaped quote inside a quoted field", () => {
  const rows = parseCsv('note\n"She said ""hi""."\n');
  assert.deepEqual(rows, [["note"], ['She said "hi".']]);
});

test("parseCsv: CRLF line endings", () => {
  const rows = parseCsv("a,b\r\n1,2\r\n");
  assert.deepEqual(rows, [
    ["a", "b"],
    ["1", "2"],
  ]);
});

test("parseCsv: strips a leading BOM", () => {
  const rows = parseCsv("﻿a,b\n1,2\n");
  assert.deepEqual(rows[0], ["a", "b"]);
});

test("parseCsv: last row without a trailing newline", () => {
  const rows = parseCsv("a,b\n1,2");
  assert.deepEqual(rows, [
    ["a", "b"],
    ["1", "2"],
  ]);
});

test("parseCsvRecords: keys by trimmed header, empty input -> []", () => {
  assert.deepEqual(parseCsvRecords(""), []);
  const records = parseCsvRecords(" Nome , E-mail \nAna,ana@x.com\n");
  assert.deepEqual(records, [{ Nome: "Ana", "E-mail": "ana@x.com" }]);
});

test("buildCsvTemplate: quotes headers that contain a comma", () => {
  const csv = buildCsvTemplate(["Nome completo", "Cidade, Estado"]);
  assert.equal(csv, 'Nome completo,"Cidade, Estado"\r\n');
});

test("buildCsvTemplate output round-trips through parseCsv", () => {
  const headers = ["Nome completo", "Área de atuação", 'Aspas "raras"'];
  const csv = buildCsvTemplate(headers);
  const [row] = parseCsv(csv);
  assert.deepEqual(row, headers);
});

/**
 * Kontrola povinných polí při zakládání záznamů.
 *
 * Prisma engines nejsou v prostředí, kde tenhle kód vzniká, dostupné, takže
 * `prisma generate` a s ním i pořádná typová kontrola neproběhnou. Tenhle
 * skript proto dělá to nejdůležitější ručně: přečte schema.prisma, zjistí,
 * která pole jsou povinná a nemají výchozí hodnotu, a ověří, že je každé
 * `prisma.<model>.create({ data: … })` v kódu opravdu vyplňuje.
 *
 * Spuštění: node --experimental-strip-types scripts/check-required-fields.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SCHEMA = "prisma/schema.prisma";
const SRC = "src";

type Model = { name: string; required: string[]; jsonFields: string[] };

function parseModels(schema: string): Model[] {
  const models: Model[] = [];
  const modelRe = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m: RegExpExecArray | null;

  while ((m = modelRe.exec(schema)) !== null) {
    const name = m[1]!;
    const required: string[] = [];
    const jsonFields: string[] = [];

    // Blokové komentáře pryč ještě před rozborem — jejich prostřední
    // řádky začínají hvězdičkou a jinak by se četly jako pole.
    const body = m[2]!.replace(/\/\*[\s\S]*?\*\//g, "");

    for (const rawLine of body.split("\n")) {
      const line = rawLine.split("//")[0]!.trim();
      if (!line || line.startsWith("@@") || line.startsWith("/")) continue;
      if (line.startsWith("*")) continue;

      const parts = line.split(/\s+/);
      const field = parts[0]!;
      const type = parts[1];
      if (!type) continue;

      if (type.replace(/[?[\]]/g, "") === "Json") jsonFields.push(field);

      // volitelné, seznamy, výchozí hodnoty a relace povinné nejsou
      if (type.endsWith("?") || type.endsWith("[]")) continue;
      if (line.includes("@default") || line.includes("@updatedAt")) continue;
      if (line.includes("@relation")) continue;
      if (/^[A-Z]/.test(type) && !SCALARS.has(type.replace(/[?[\]]/g, ""))) {
        // Vztah na jiný model se nezakládá přes skalární pole.
        if (!ENUMS.has(type)) continue;
      }
      required.push(field);
    }
    models.push({ name, required, jsonFields });
  }
  return models;
}

const SCALARS = new Set([
  "String",
  "Int",
  "Boolean",
  "DateTime",
  "Float",
  "Decimal",
  "Json",
  "Bytes",
]);

const schemaText = readFileSync(SCHEMA, "utf8");
const ENUMS = new Set(
  [...schemaText.matchAll(/^enum\s+(\w+)\s*\{/gm)].map((m) => m[1]!),
);

const models = parseModels(schemaText);
const byLowerName = new Map(models.map((m) => [lower(m.name), m]));

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Tělo bloku `data: { … }` u volání začínajícího na `from`. */
function dataBody(source: string, from: number): string | null {
  const dataIdx = source.indexOf("data:", from);
  if (dataIdx === -1 || dataIdx > from + 200) return null;
  const open = source.indexOf("{", dataIdx);
  if (open === -1) return null;

  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return null;
}

/** Najde blok `data: { … }` a vrátí jména klíčů na nejvyšší úrovni. */
function dataKeys(source: string, from: number): string[] | null {
  const dataIdx = source.indexOf("data:", from);
  if (dataIdx === -1 || dataIdx > from + 200) return null;
  const open = source.indexOf("{", dataIdx);
  if (open === -1) return null;

  let depth = 0;
  let i = open;
  for (; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  const body = source.slice(open + 1, i);

  const keys: string[] = [];
  let d = 0;
  let token = "";
  for (let j = 0; j < body.length; j++) {
    const ch = body[j]!;
    if (ch === "{" || ch === "[" || ch === "(") d++;
    else if (ch === "}" || ch === "]" || ch === ")") d--;
    else if (d === 0 && ch === ":") {
      const key = token.trim().split(/[\s,]+/).pop() ?? "";
      if (/^\w+$/.test(key)) keys.push(key);
      token = "";
      continue;
    } else if (d === 0 && ch === ",") {
      // zkrácený zápis `userId,`
      const key = token.trim();
      if (/^\w+$/.test(key)) keys.push(key);
      token = "";
      continue;
    }
    if (d === 0) token += ch;
  }
  const last = token.trim();
  if (/^\w+$/.test(last)) keys.push(last);
  return keys;
}

let problems = 0;
let checked = 0;

for (const file of walk(SRC)) {
  const source = readFileSync(file, "utf8");
  const re = /prisma\.(\w+)\.(create|createMany)\s*\(/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(source)) !== null) {
    const model = byLowerName.get(m[1]!);
    if (!model) continue;
    const keys = dataKeys(source, m.index);
    if (!keys) continue;

    checked++;
    const missing = model.required.filter((f) => !keys.includes(f));
    if (missing.length > 0) {
      problems++;
      const line = source.slice(0, m.index).split("\n").length;
      console.log(
        `  CHYBÍ  ${file}:${line}  ${model.name}.create() nevyplňuje: ${missing.join(", ")}`,
      );
    }
  }
}

/**
 * Prázdný Json sloupec se v Prismě nastavuje přes `Prisma.DbNull`.
 * Obyčejné `null` znamená „neměnit“ a typová kontrola ho zamítne —
 * ale až při buildu, protože náhradní typy zápisy nekontrolují.
 */
let jsonProblems = 0;
const modelsWithJson = models.filter((m) => m.jsonFields.length > 0);

if (modelsWithJson.length > 0) {
  for (const file of walk(SRC)) {
    const source = readFileSync(file, "utf8");

    for (const model of modelsWithJson) {
      const callRe = new RegExp(
        `prisma\\.${lower(model.name)}\\.(create|update|updateMany|upsert)\\s*\\(`,
        "g",
      );
      let call: RegExpExecArray | null;

      while ((call = callRe.exec(source)) !== null) {
        // Jen vlastní blok data — širší okno by zasahovalo do sousedního
        // volání a hlásilo tutéž chybu dvakrát.
        const chunk = dataBody(source, call.index);
        if (!chunk) continue;
        for (const field of model.jsonFields) {
          const bad = new RegExp(`\\b${field}\\s*:\\s*null\\b`);
          if (bad.test(chunk)) {
            jsonProblems++;
            const line = source.slice(0, call.index).split("\n").length;
            console.log(
              `  JSON   ${file}:${line}  ${model.name}.${field} se nastavuje na null — použij Prisma.DbNull`,
            );
          }
        }
      }
    }
  }
}

console.log(`\nProkontrolováno ${checked} volání create().`);
console.log(
  problems === 0
    ? "Všechna povinná pole jsou vyplněná."
    : `${problems} volání s chybějícím povinným polem.`,
);
if (modelsWithJson.length > 0) {
  console.log(
    jsonProblems === 0
      ? "Json sloupce se nikde nenastavují na null."
      : `${jsonProblems} zápisů null do Json sloupce.`,
  );
}
process.exit(problems === 0 && jsonProblems === 0 ? 0 : 1);

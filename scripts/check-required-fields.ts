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

type Model = { name: string; required: string[] };

function parseModels(schema: string): Model[] {
  const models: Model[] = [];
  const modelRe = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m: RegExpExecArray | null;

  while ((m = modelRe.exec(schema)) !== null) {
    const name = m[1]!;
    const required: string[] = [];

    for (const rawLine of m[2]!.split("\n")) {
      const line = rawLine.split("//")[0]!.trim();
      if (!line || line.startsWith("@@") || line.startsWith("/")) continue;

      const parts = line.split(/\s+/);
      const field = parts[0]!;
      const type = parts[1];
      if (!type) continue;

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
    models.push({ name, required });
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

console.log(`\nProkontrolováno ${checked} volání create().`);
console.log(
  problems === 0
    ? "Všechna povinná pole jsou vyplněná."
    : `${problems} volání s chybějícím povinným polem.`,
);
process.exit(problems === 0 ? 0 : 1);

/**
 * Náhradní typy Prisma klienta pro místní kontrolu.
 *
 * Prisma engines se v prostředí, kde tenhle kód vzniká, nedají stáhnout,
 * takže `prisma generate` neproběhne a `@prisma/client` je bez typů. Výsledek:
 * všechno z databáze je `any`, tsc mlčí a chyba se ukáže až při buildu na
 * Vercelu. Přesně tak spadl build na `season?.incomeKind`.
 *
 * Tenhle skript přečte schema.prisma a vygeneruje `types/prisma-stub.d.ts`
 * s modely a klientem. Používá se JEN pro `npm run check:types` přes
 * tsconfig.check.json — do buildu nevstupuje, tam běží skutečný klient.
 *
 * Vědomé omezení: `select` a `include` se nesimulují. Každý model se tváří
 * jako načtený celý včetně vztahů, takže sáhnout na nenačtený vztah tahle
 * kontrola neodhalí. Odhalí ale překlepy a nesoulad typů u skalárních polí
 * a výčtů — a to je přesně ta třída chyb, která sem chodí.
 *
 * Zapisované hodnoty se dlouho nekontrolovaly vůbec (`data` bylo
 * `Record<string, unknown>`) a build padal na Vercelu na tom, že do sloupce
 * s výčtem šel obyčejný `string`. Proto se u `create`/`update`/`upsert`
 * hlídají aspoň sloupce s výčtem — ostatní klíče zůstávají volné, aby se
 * nemuselo modelovat celé Prisma API se vztahy a operátory.
 *
 * Spuštění: npm run gen:prisma-stub
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const SCHEMA = "prisma/schema.prisma";
const OUT = "types/prisma-stub.d.ts";

const SCALAR_TS: Record<string, string> = {
  String: "string",
  Int: "number",
  Float: "number",
  Boolean: "boolean",
  DateTime: "Date",
  Decimal: "number",
  Json: "unknown",
  Bytes: "Uint8Array",
  BigInt: "bigint",
};

const schema = readFileSync(SCHEMA, "utf8");

const enums = [...schema.matchAll(/^enum\s+(\w+)\s*\{([\s\S]*?)^\}/gm)].map(
  (m) => ({
    name: m[1]!,
    values: m[2]!
      .split("\n")
      .map((l) => l.split("//")[0]!.trim())
      .filter((l) => /^\w+$/.test(l)),
  }),
);
const enumNames = new Set(enums.map((e) => e.name));

type Field = { name: string; ts: string; optional: boolean };
type Model = { name: string; fields: Field[]; enumFields: Field[] };

const models: Model[] = [];
for (const m of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
  const name = m[1]!;
  const fields: Field[] = [];
  const enumFields: Field[] = [];

  for (const rawLine of m[2]!.split("\n")) {
    const line = rawLine.split("//")[0]!.trim();
    if (!line || line.startsWith("@@") || line.startsWith("/")) continue;

    const parts = line.split(/\s+/);
    const fieldName = parts[0]!;
    const rawType = parts[1];
    if (!rawType || !/^\w+$/.test(fieldName)) continue;

    const isList = rawType.endsWith("[]");
    const isOptional = rawType.endsWith("?");
    const base = rawType.replace(/[?\[\]]/g, "");

    if (SCALAR_TS[base]) {
      const ts = SCALAR_TS[base]! + (isList ? "[]" : "");
      fields.push({
        name: fieldName,
        ts: isOptional ? `${ts} | null` : ts,
        optional: false,
      });
    } else if (enumNames.has(base)) {
      const ts = base + (isList ? "[]" : "");
      fields.push({
        name: fieldName,
        ts: isOptional ? `${ts} | null` : ts,
        optional: false,
      });
      // Zapisovaná hodnota: u nepovinného sloupce se smí poslat i null.
      enumFields.push({
        name: fieldName,
        ts: isOptional ? `${ts} | null` : ts,
        optional: true,
      });
    } else {
      // Vztah. Tváří se, jako by byl vždycky načtený — jinak by kontrola
      // hlásila „possibly undefined“ na každém `include`, což je šum,
      // ve kterém by skutečná chyba zanikla. Nenačtený vztah je věc běhu,
      // ne typů. Nepovinný vztah zůstává nullable, tam null nastat může.
      fields.push({
        name: fieldName,
        ts: isList ? `${base}[]` : isOptional ? `${base} | null` : base,
        optional: false,
      });
    }
  }
  models.push({ name, fields, enumFields });
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const lines: string[] = [
  "// VYGENEROVANÝ SOUBOR — needituj, vzniká z prisma/schema.prisma",
  "// přes `npm run gen:prisma-stub`. Slouží jen místní kontrole typů",
  "// (tsconfig.check.json); build na Vercelu používá skutečného klienta.",
  "",
  'declare module "@prisma/client" {',
];

for (const e of enums) {
  lines.push(
    `  export type ${e.name} = ${e.values.map((v) => `"${v}"`).join(" | ")};`,
  );
  // Výčet se používá i jako hodnota, ne jen jako typ.
  lines.push(`  export const ${e.name}: {`);
  for (const v of e.values) lines.push(`    ${v}: "${v}";`);
  lines.push("  };");
}
lines.push("");

for (const model of models) {
  lines.push(`  export type ${model.name} = {`);
  for (const f of model.fields) {
    lines.push(`    ${f.name}${f.optional ? "?" : ""}: ${f.ts};`);
  }
  // Prisma přidává _count při `include: { _count: … }`.
  lines.push("    _count: Record<string, number>;");
  lines.push("  };");
  lines.push("");

  // Tvar zápisu. Obsahuje jen sloupce s výčtem — ostatní klíče projdou
  // volně (viz Args), protože vztahy a operátory se tu nemodelují.
  lines.push(`  type ${model.name}Write = {`);
  for (const f of model.enumFields) {
    lines.push(`    ${f.name}?: ${f.ts};`);
  }
  // Index musí zůstat — bez něj by kontrola hlásila každý normální sloupec
  // jako neznámý. Hlídají se jen výčty, zbytek projde.
  lines.push("    [key: string]: unknown;");
  lines.push("  };");
  lines.push("");
}

// Argumenty se nemodelují — kontroluje se tvar výsledku, ne dotazu.
lines.push("  type Args = Record<string, unknown>;");
lines.push("");
lines.push("  type Delegate<T, W> = {");
lines.push("    findMany(args?: Args): Promise<T[]>;");
lines.push("    findFirst(args?: Args): Promise<T | null>;");
lines.push("    findUnique(args: Args): Promise<T | null>;");
lines.push("    findUniqueOrThrow(args: Args): Promise<T>;");
// `data` přes generikum s omezením: neprojde `string` tam, kde schéma
// čeká výčet. Ostatní klíče zůstávají volné.
lines.push("    create<D extends W>(args: Args & { data: D }): Promise<T>;");
lines.push(
  "    createMany<D extends W>(args: Args & { data: D | D[] }): Promise<{ count: number }>;",
);
lines.push("    update<D extends W>(args: Args & { data: D }): Promise<T>;");
lines.push(
  "    updateMany<D extends W>(args: Args & { data: D }): Promise<{ count: number }>;",
);
lines.push(
  "    upsert<C extends W, U extends W>(args: Args & { create: C; update: U }): Promise<T>;",
);
lines.push("    delete(args: Args): Promise<T>;");
lines.push("    deleteMany(args?: Args): Promise<{ count: number }>;");
lines.push("    count(args?: Args): Promise<number>;");
lines.push("    aggregate(args?: Args): Promise<Record<string, never>>;");
// Tvar výsledku groupBy plyne z argumentů, které se tu nemodelují.
// Nechává se volný, jinak by hlásil chyby tam, kde žádné nejsou.
lines.push("    // eslint-disable-next-line @typescript-eslint/no-explicit-any");
lines.push("    groupBy(args: Args): Promise<any[]>;");
lines.push("  };");
lines.push("");

lines.push("  export type PrismaClientLike = {");
for (const model of models) {
  lines.push(
    `    ${lower(model.name)}: Delegate<${model.name}, ${model.name}Write>;`,
  );
}
lines.push("    $transaction(ops: readonly Promise<unknown>[]): Promise<unknown[]>;");
// Druhý argument je nastavení interaktivní transakce. Hlavně `timeout`:
// výchozích 5 s nestačí, když se rozdává rating dvaceti hráčům.
lines.push(
  "    $transaction<R>(fn: (tx: PrismaClientLike) => Promise<R>, options?: { timeout?: number; maxWait?: number; isolationLevel?: string }): Promise<R>;",
);
lines.push("    $connect(): Promise<void>;");
lines.push("    $disconnect(): Promise<void>;");
lines.push("  };");
lines.push("");
// Prisma.DbNull / JsonNull — prázdná hodnota v nullable Json sloupci.
// Obyčejné null tam znamená „neměnit“, ne „vyprázdnit“.
lines.push("  export const Prisma: {");
lines.push('    DbNull: { readonly __brand: "DbNull" };');
lines.push('    JsonNull: { readonly __brand: "JsonNull" };');
lines.push("  };");
lines.push("");
lines.push("  export const PrismaClient: {");
lines.push("    new (args?: Args): PrismaClientLike;");
lines.push("  };");
lines.push("  export type PrismaClient = PrismaClientLike;");
lines.push("}");
lines.push("");

mkdirSync("types", { recursive: true });
writeFileSync(OUT, lines.join("\n"), "utf8");

console.log(
  `Vygenerováno ${OUT}: ${models.length} modelů, ${enums.length} výčtů.`,
);

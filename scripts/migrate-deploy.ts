/**
 * Migrace databáze při buildu — jen při produkčním nasazení.
 *
 * Vercel staví i náhled každého pull requestu (VERCEL_ENV=preview).
 * Náhled nesmí migrovat: s produkční DIRECT_URL by nové migrace
 * doběhly na ostrá data ještě před mergem, a bez ní build padal na
 * „Environment variable not found: DIRECT_URL“.
 *
 * Mimo Vercel (VERCEL_ENV chybí) se migruje jako dřív.
 *
 * Spouští se z `npm run build`.
 */
import { spawnSync } from "node:child_process";

const env = process.env.VERCEL_ENV;

if (env && env !== "production") {
  console.log(`Migrace přeskočeny — VERCEL_ENV=${env}, migruje se jen produkce.`);
  process.exit(0);
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);

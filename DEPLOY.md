# Nasazení: GitHub + Vercel + Neon

Tento návod předpokládá **veřejný GitHub repozitář** a že **zdrojový kód** může vidět kdokoli. **Data uživatelů, hesla ani přístup k databázi** v repu **nejsou** — žijí jen v Neonu a v proměnných prostředí na Vercelu.

## Checklist: nasazení online (po pořadí)

1. **Neon** — vytvoř projekt, zkopíruj connection string (`DATABASE_URL`).
2. **Lokálně** — `.env` s `DATABASE_URL` + `AUTH_SECRET` (+ volitelně `AUTH_URL=http://localhost:3000`). Spusť `npx prisma migrate deploy`, pak `npm run dev`, ověř že app běží.
3. **Git** — `git init` / remote na GitHub, **push bez `.env`** (kontrola: `.env` není v commitu).
4. **Vercel** — Import Project z GitHubu. Před prvním deployem nastav env proměnné (viz níže). **První deploy:** `ALLOW_REGISTRATION` **nenastavuj na `false`**, dokud nemáš účet (nebo ho vynech = registrace povolená).
5. Po deployi zkopíruj produkční URL (např. `https://xyz.vercel.app`), v **Settings → Environment Variables** nastav **`AUTH_URL`** na tuto adresu (včetně `https://`), **Redeploy**.
6. Otevři produkční URL → **`/registrace`** → založ účet.
7. Ve Vercelu nastav **`ALLOW_REGISTRATION=false`**, **Redeploy** — veřejně se už nikdo neregistruje.
8. (Volitelně) Vlastní doména ve Vercelu → znovu uprav **`AUTH_URL`** na novou URL a redeploy.

## Co zůstává soukromé

| Co | Kde to je | Nikdy do Gitu |
|----|-----------|----------------|
| Přihlašovací údaje k DB | `DATABASE_URL` na Vercelu / v lokálním `.env` | Ano — jen `.env.example` bez reálných hodnot |
| `AUTH_SECRET` (podpis cookies / JWT) | Vercel Environment Variables | Ano |
| Obsah databáze (hráči, docházka, …) | Neon | Ano |
| Tvé heslo k účtu | Hash v Neonu | Ano |

Soubor `.env` je v `.gitignore`. Veřejný repozitář smí obsahovat jen **`.env.example`** (vzor bez tajných hodnot).

## Jednorázová registrace účtu (jen ty)

1. Lokálně nebo dočasně na Vercelu nech `ALLOW_REGISTRATION=true` (nebo proměnnou vůbec nenastavuj).
2. Otevři `/registrace`, založ si účet.
3. Na Vercelu nastav **`ALLOW_REGISTRATION=false`**, redeploy. Veřejně pak nepůjde založit další účet (endpoint zůstává chráněný i na úrovni serverové akce).

## Krok 1: Neon (PostgreSQL)

1. Jdi na [https://neon.tech](https://neon.tech), přihlas se (GitHub účet je v pohodě).
2. **Create project**, zvol region (např. Frankfurt).
3. V **Dashboard → Connection details** zkopíruj **connection string** pro `psql` / aplikaci — typicky tvar:
   `postgresql://USER:PASSWORD@HOST/neondb?sslmode=require`
4. Ulož si ho do poznámek (je to tajemství).

## Krok 2: Lokální `.env` (vývoj)

V kořeni projektu zkopíruj vzor a doplň hodnoty:

```bash
cp .env.example .env
```

- `DATABASE_URL` = connection string z Neonu (stejná DB může sloužit pro první testy; později můžeš v Neonu vytvořit druhý projekt „production“).
- `AUTH_SECRET` = náhodný řetězec, např. `openssl rand -base64 32` (Windows: PowerShell `[Convert]::ToBase64String((1..32|%{Get-Random -Max 256}))` nebo online generator jen pro dev).
- `AUTH_URL=http://localhost:3000`
- `ALLOW_REGISTRATION=true` (pro první registraci)

Aplikuj migrace na databázi:

```bash
npx prisma migrate deploy
```

Spusť aplikaci (`npm run dev`), zaregistruj účet, ověř přihlášení.

## Krok 3: GitHub

```bash
git add .
git commit -m "Postgres + migrace + nasazení"
git push origin main
```

Ujisti se, že **necommituješ** soubor `.env` (má být ignorovaný).

## Krok 4: Vercel

1. Jdi na [https://vercel.com](https://vercel.com), přihlas se, **Add New → Project**, importuj **stejný** GitHub repozitář.
2. **Framework Preset:** Next.js (detekuje se sám). Build příkaz nech výchozí — v `package.json` je `build`, který spustí `prisma generate`, `prisma migrate deploy` a `next build`.
3. **Environment Variables** (při importu nebo **Settings → Environment Variables**):

   | Jméno | Hodnota | Kdy |
   |-------|---------|-----|
   | `DATABASE_URL` | stejný connection string z Neonu | před prvním deployem |
   | `AUTH_SECRET` | dlouhý náhodný řetězec (může být jiný než lokálně) | před prvním deployem |
   | `AUTH_URL` | po prvním deployi: přesná URL `https://….vercel.app` | hned po prvním deployi, pak Redeploy |
   | `ALLOW_REGISTRATION` | `false` | **až po** založení účtu na `/registrace` |

   **První deploy:** nastav minimálně `DATABASE_URL` a `AUTH_SECRET`. `AUTH_URL` doplníš po zobrazení URL projektu. `ALLOW_REGISTRATION=false` nastav až když už máš svůj účet, jinak se na produkci neregistruješ.

4. **Deploy**. Migrace se na Vercelu spustí v rámci buildu a vytvoří tabulky v Neonu.

5. Nastav **`AUTH_URL`** na produkční adresu, **Redeploy**. Zaregistruj se na **`https://…/registrace`**, pak nastav **`ALLOW_REGISTRATION=false`** a znovu **Redeploy**.

## Krok 5: Bezpečnost navíc (doporučení)

- **Neon:** v dashboardu omez přístup jen na potřebné (heslo k DB je v connection stringu — chovej se k němu jako k heslu).
- **Vercel:** proměnné vidíš jen ty pod účtem projektu.
- **Heslo účtu:** silné heslo; účet máš jen ty po vypnutí registrace.
- Veřejný kód neobsahuje osobní údaje — žádný export CSV s daty v repu.

## Problémy

- **Build fail na `prisma migrate deploy`:** zkontroluj `DATABASE_URL` na Vercelu (včetně `sslmode=require` pokud Neon vyžaduje).
- **Přihlášení na produkci nefunguje:** zkontroluj `AUTH_SECRET` (musí být nastavený) a `AUTH_URL` (shoda s reálnou URL v prohlížeči).
- **Lokálně po přechodu z SQLite:** starý `dev.db` už se nepoužívá; data přesuň ručně nebo založ účet znovu proti Neonu.

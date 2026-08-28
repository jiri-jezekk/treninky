# Migrace

## Když nasazení spadne na P3018

Chyba vypadá takhle:

```
Error: P3018
A migration failed to apply. New migrations cannot be applied before the error is recovered from.
Migration name: 20260828170000_rating_duely_zapasy_vyzvy
Database error: ERROR: type "DuelStatus" already exists
```

Znamená to, že se migrace pustila, část práce odvedla a pak spadla.
Prisma si ji poznamenala jako neúspěšnou a dokud ten záznam nezmizí,
odmítne pustit cokoli dalšího — i to, co s ní nesouvisí.

Postup:

1. **Zjisti, co v databázi je.** V Neonu (SQL editor):

   ```sql
   SELECT migration_name, started_at, finished_at, rolled_back_at
   FROM "_prisma_migrations"
   ORDER BY started_at;
   ```

   Řádek s `finished_at IS NULL` je ta rozdělaná migrace.

2. **Smaž ten neúspěšný záznam.** Podmínka `finished_at IS NULL` je tam
   schválně — úspěšně dokončenou migraci nesmí smazat ani překlep:

   ```sql
   DELETE FROM "_prisma_migrations"
   WHERE migration_name = '20260828170000_rating_duely_zapasy_vyzvy'
     AND finished_at IS NULL;
   ```

   Totéž umí i CLI, když máš lokálně nastavené `DIRECT_URL`:

   ```
   npx prisma migrate resolve --rolled-back "20260828170000_rating_duely_zapasy_vyzvy"
   ```

3. **Nasaď znovu.** Migrace se pustí od začátku.

## Proč jsou migrace psané „když už to tam je, nevadí“

Krok 3 funguje jen tehdy, když migrace snese opakované spuštění nad
databází, kde už část jejích objektů je. Proto:

- `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- výčty a cizí klíče v `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  (pro ně `IF NOT EXISTS` neexistuje)
- vkládaná data přes `WHERE NOT EXISTS`, aby nevznikla podruhé

Zvlášť u dat na tom záleží: druhý běh nesmí přepsat nic, co už je
odehrané. Sezóna se zakládá jen když chybí, rating jen hráčům, kteří
ho v té sezóně nemají — kdo už nějaký nasbíral, ten si ho nechá.

Každá migrace, která krom struktury sahá i na data, má na konci
kontrolu, která ji shodí, když výsledek nesedí. Lepší spadnout
v migraci než tiše rozjet aplikaci nad polovičními daty.

## Starší podoba ratingu v produkci

Produkční databáze měla rating v jiné podobě, než jakou popisují migrace:
rating byl jedno číslo u hráče (`Player.ratingPoints`), duely a výzvy se
vázaly na číselník `Discipline` a sezóny neexistovaly. V `_prisma_migrations`
o tom nebyl záznam — tedy se to tam dostalo mimo migrace.

Projevilo se to až při nasazení jako `column "seasonId" does not exist`:
tabulka `Duel` v databázi byla, ale jiná, takže ji `CREATE TABLE IF NOT
EXISTS` přeskočil a další příkaz spadl na sloupci, který v ní není.

Migrace `20260828170000` proto začíná úklidem. Nic nemaže — staré tabulky
odsune do schématu `stary_rating`, kde je aplikace nevidí (Prisma se dívá
jen do `public`) a data zůstanou k nahlédnutí:

```sql
SELECT * FROM stary_rating."Discipline";
SELECT * FROM stary_rating."PlayerRatingPoints";  -- rating hráčů před resetem
```

Odsun jde přes `SET SCHEMA`, které bere s sebou i indexy a klíče — jinak
by se nové tabulky nemohly jmenovat stejně. Spustí se jen když je stará
podoba poznat (`Duel.disciplineId` nebo tabulka `Discipline`), takže
opakované nasazení už nové tabulky nikam neodsune.

Až bude jasné, že v archivu nic nechybí, smaže se celý najednou:

```sql
DROP SCHEMA stary_rating CASCADE;
```

Stav produkce před opravou je zapsaný v `scripts/fixtures/stary-rating.sql`
a migrace je proti němu odladěná.

## Co nedělat

- **`prisma db push` na produkci.** Změní strukturu, ale do
  `_prisma_migrations` nic nezapíše — od té chvíle si migrace a skutečná
  databáze neodpovídají a další nasazení spadne na něčem, co „už existuje“.
- **Editovat migraci, která je úspěšně nasazená.** Prisma si u ní drží
  kontrolní součet a při neshodě nasazení zastaví. Měnit se smí jen ta,
  jejíž záznam byl smazaný podle postupu výš.

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

## Co nedělat

- **`prisma db push` na produkci.** Změní strukturu, ale do
  `_prisma_migrations` nic nezapíše — od té chvíle si migrace a skutečná
  databáze neodpovídají a další nasazení spadne na něčem, co „už existuje“.
- **Editovat migraci, která je úspěšně nasazená.** Prisma si u ní drží
  kontrolní součet a při neshodě nasazení zastaví. Měnit se smí jen ta,
  jejíž záznam byl smazaný podle postupu výš.

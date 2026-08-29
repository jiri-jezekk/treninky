-- Volba, jestli se hraje na body, nebo na čas.
--
-- Dřív tu byl jen přepínač „vyhrává vyšší“ a hodnota se četla jako
-- holé číslo. Čas se proto zadával v celých sekundách — na běh nebo
-- na člunkový běh je to málo, tam rozhoduje desetina. Nově se u výzvy
-- i duelu vybírá druh měření; na čas se píše „1:23,45“ a ukládá se
-- v sekundách.
--
-- Psáno tak, aby šlo pustit znovu; viz README ve složce migrací.

DO $$ BEGIN
    CREATE TYPE "Measure" AS ENUM ('POINTS', 'TIME');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- I existující typ musí mít obě hodnoty. Právě na tomhle spadlo
-- vyhodnocení zápasu: typ existoval, ale hodnotu 'MATCH' neměl.
ALTER TYPE "Measure" ADD VALUE IF NOT EXISTS 'POINTS';
ALTER TYPE "Measure" ADD VALUE IF NOT EXISTS 'TIME';

ALTER TABLE "Duel" ADD COLUMN IF NOT EXISTS "measure" "Measure" NOT NULL DEFAULT 'POINTS';
ALTER TABLE "Challenge" ADD COLUMN IF NOT EXISTS "measure" "Measure" NOT NULL DEFAULT 'POINTS';

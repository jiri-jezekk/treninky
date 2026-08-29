-- Soupiska rozboru: kdo u toho zápasu hrál.
--
-- Klub má dvacet lidí, na turnaj jich jede deset. Při zapisování se
-- proklikávala všechna jména, i ta, co u zápasu nebyla. Soupiska je
-- proto u rozboru, ne u klubu — každý zápas má jinou.
--
-- Prázdná soupiska znamená „všichni“. Díky tomu se nic nemigruje:
-- existující rozbory se chovají přesně jako dosud.
--
-- Psáno tak, aby šlo pustit znovu; viz README ve složce migrací.

CREATE TABLE IF NOT EXISTS "ReviewRoster" (
    "reviewId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "ReviewRoster_pkey" PRIMARY KEY ("reviewId", "playerId")
);

CREATE INDEX IF NOT EXISTS "ReviewRoster_playerId_idx" ON "ReviewRoster"("playerId");

DO $$ BEGIN
    ALTER TABLE "ReviewRoster" ADD CONSTRAINT "ReviewRoster_reviewId_fkey"
        FOREIGN KEY ("reviewId") REFERENCES "VideoReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Smazaný hráč zmizí i ze soupisky; zápisy po něm zůstanou (tam je
-- vazba na SET NULL, aby čísla zápasu seděla dál).
DO $$ BEGIN
    ALTER TABLE "ReviewRoster" ADD CONSTRAINT "ReviewRoster_playerId_fkey"
        FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Pojistka: bez tabulky by se chyba projevila až trenérovi při
-- otevření rozboru.
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ReviewRoster'
    ) THEN
        RAISE EXCEPTION 'Migrace zastavena: tabulka ReviewRoster nevznikla';
    END IF;
END $$;

-- Kategorie a sezóna u rozboru.
--
-- Klub hraje ve víc sestavách (Muži, Ženy, MIX A…) a jejich čísla nemá
-- smysl míchat dohromady. Kategorie se bere z už existujících kategorií
-- hráčů, ať se nezakládá druhý číselník téhož; sezóna z klubových sezón,
-- takže se dá dívat zvlášť na letošek a na loňsko.
--
-- Obojí nepovinné. Nezařazený rozbor se ukáže jen v „Vše“ — filtr má
-- odpovídat tomu, co je v něm napsané, ne skoro.
--
-- Psáno tak, aby šlo pustit znovu; viz README ve složce migrací.

ALTER TABLE "VideoReview" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
ALTER TABLE "VideoReview" ADD COLUMN IF NOT EXISTS "seasonId" TEXT;

CREATE INDEX IF NOT EXISTS "VideoReview_groupId_idx" ON "VideoReview"("groupId");
CREATE INDEX IF NOT EXISTS "VideoReview_seasonId_idx" ON "VideoReview"("seasonId");

-- Smazaná kategorie ani sezóna nesmí vzít rozbor s sebou; zápisy z videa
-- platí dál, jen se přestanou filtrovat.
DO $$ BEGIN
    ALTER TABLE "VideoReview" ADD CONSTRAINT "VideoReview_groupId_fkey"
        FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "VideoReview" ADD CONSTRAINT "VideoReview_seasonId_fkey"
        FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Pojistka: chybějící sloupec by se projevil až trenérovi při otevření
-- rozborů.
DO $$
DECLARE chybi TEXT := '';
    c TEXT;
BEGIN
    FOREACH c IN ARRAY ARRAY['groupId', 'seasonId'] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'VideoReview' AND column_name = c
        ) THEN
            chybi := chybi || c || ' ';
        END IF;
    END LOOP;

    IF chybi <> '' THEN
        RAISE EXCEPTION 'Migrace zastavena: chybí sloupce ve VideoReview: %', chybi;
    END IF;
END $$;

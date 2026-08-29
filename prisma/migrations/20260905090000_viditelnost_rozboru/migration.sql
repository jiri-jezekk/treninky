-- Viditelnost rozboru pro hráče.
--
-- Rozbor cizího týmu se dělá kvůli přípravě a nemá viset klubu na
-- očích. Zapnuté ve výchozím stavu, protože drtivá většina rozborů je
-- vlastní zápas — a hlavně aby nasazením nikomu nezmizelo, co dosud
-- viděl.
--
-- Psáno tak, aby šlo pustit znovu; viz README ve složce migrací.

ALTER TABLE "VideoReview" ADD COLUMN IF NOT EXISTS "visibleToPlayers" BOOLEAN NOT NULL DEFAULT true;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'VideoReview'
          AND column_name = 'visibleToPlayers'
    ) THEN
        RAISE EXCEPTION 'Migrace zastavena: sloupec VideoReview.visibleToPlayers nevznikl';
    END IF;
END $$;

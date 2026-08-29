-- Rozbory zápasů z videa.
--
-- Samostatná věc, ne příznak u zápasu (Match). Match patří ratingu
-- a rozdává body; rozbor je poznámkový blok navázaný na časovou osu
-- záznamu. Rozebírá se i to, co se nehrálo na tréninku, a naopak
-- tréninkový zápas rozbor mít nemusí — proto je vazba nepovinná.
--
-- Psáno tak, aby šlo pustit znovu; viz README ve složce migrací.

DO $$ BEGIN
    CREATE TYPE "ReviewSide" AS ENUM ('FOR', 'AGAINST', 'NEUTRAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- I existující typ musí mít všechny hodnoty. Na tomhle spadlo
-- vyhodnocení zápasu: typ existoval, ale hodnotu 'MATCH' neměl.
ALTER TYPE "ReviewSide" ADD VALUE IF NOT EXISTS 'FOR';
ALTER TYPE "ReviewSide" ADD VALUE IF NOT EXISTS 'AGAINST';
ALTER TYPE "ReviewSide" ADD VALUE IF NOT EXISTS 'NEUTRAL';

CREATE TABLE IF NOT EXISTS "VideoReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "opponent" TEXT,
    "playedOn" DATE NOT NULL,
    "videoId" TEXT,
    "notes" TEXT,
    "matchId" TEXT,
    "sharedAll" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VideoReview_userId_playedOn_idx" ON "VideoReview"("userId", "playedOn");

DO $$ BEGIN
    ALTER TABLE "VideoReview" ADD CONSTRAINT "VideoReview_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Smazaný zápas nesmí vzít s sebou rozbor — poznámky z videa platí dál.
DO $$ BEGIN
    ALTER TABLE "VideoReview" ADD CONSTRAINT "VideoReview_matchId_fkey"
        FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ReviewEventType" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "side" "ReviewSide" NOT NULL DEFAULT 'NEUTRAL',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ReviewEventType_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReviewEventType_userId_archived_idx" ON "ReviewEventType"("userId", "archived");

DO $$ BEGIN
    ALTER TABLE "ReviewEventType" ADD CONSTRAINT "ReviewEventType_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ReviewEvent" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "atSeconds" INTEGER NOT NULL,
    "playerId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReviewEvent_reviewId_atSeconds_idx" ON "ReviewEvent"("reviewId", "atSeconds");
CREATE INDEX IF NOT EXISTS "ReviewEvent_playerId_idx" ON "ReviewEvent"("playerId");

DO $$ BEGIN
    ALTER TABLE "ReviewEvent" ADD CONSTRAINT "ReviewEvent_reviewId_fkey"
        FOREIGN KEY ("reviewId") REFERENCES "VideoReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RESTRICT schválně: typ tlačítka se archivuje, nemaže. Kdyby šel
-- smazat, zůstaly by zápisy bez toho, co vlastně znamenají.
DO $$ BEGIN
    ALTER TABLE "ReviewEvent" ADD CONSTRAINT "ReviewEvent_typeId_fkey"
        FOREIGN KEY ("typeId") REFERENCES "ReviewEventType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Smazaný hráč nesmí smazat zápis — akce se stala, jen u ní nebude jméno.
DO $$ BEGIN
    ALTER TABLE "ReviewEvent" ADD CONSTRAINT "ReviewEvent_playerId_fkey"
        FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ReviewShare" (
    "reviewId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "ReviewShare_pkey" PRIMARY KEY ("reviewId", "playerId")
);

CREATE INDEX IF NOT EXISTS "ReviewShare_playerId_idx" ON "ReviewShare"("playerId");

DO $$ BEGIN
    ALTER TABLE "ReviewShare" ADD CONSTRAINT "ReviewShare_reviewId_fkey"
        FOREIGN KEY ("reviewId") REFERENCES "VideoReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ReviewShare" ADD CONSTRAINT "ReviewShare_playerId_fkey"
        FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Pojistka: všechny čtyři tabulky musí existovat. Bez ní by se
-- chybějící tabulka projevila až trenérovi při otevření rozborů.
DO $$
DECLARE chybi TEXT := '';
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['VideoReview', 'ReviewEventType', 'ReviewEvent', 'ReviewShare'] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t
        ) THEN
            chybi := chybi || t || ' ';
        END IF;
    END LOOP;

    IF chybi <> '' THEN
        RAISE EXCEPTION 'Migrace zastavena: chybí tabulky: %', chybi;
    END IF;
END $$;

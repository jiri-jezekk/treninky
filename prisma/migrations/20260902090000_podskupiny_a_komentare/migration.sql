-- Podskupiny tlačítek a komentáře k rozboru.
--
-- Podskupina: „Hit counter fast“ a „Hit counter slow“ je tentýž herní
-- moment zahraný jinak. Bez podskupiny se nedá říct, kolik z hitů
-- padlo z counteru dohromady — a přesně tohle číslo trenér potřebuje.
-- Sloupec je nepovinný a prázdný, takže se nic nemigruje.
--
-- Komentáře: rozbor je debata, ne vývěska. Hráč, co u toho byl, ví
-- věci, které z videa vidět nejsou. Jméno se ukládá i do komentáře,
-- aby zůstal čitelný, když hráč z klubu odejde.
--
-- Psáno tak, aby šlo pustit znovu; viz README ve složce migrací.

ALTER TABLE "ReviewEventType" ADD COLUMN IF NOT EXISTS "subLabel" TEXT;

CREATE TABLE IF NOT EXISTS "ReviewComment" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "playerId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReviewComment_reviewId_createdAt_idx"
    ON "ReviewComment"("reviewId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReviewComment_playerId_idx" ON "ReviewComment"("playerId");

DO $$ BEGIN
    ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_reviewId_fkey"
        FOREIGN KEY ("reviewId") REFERENCES "VideoReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Smazaný hráč nesmí vzít komentář s sebou; jméno v něm zůstává.
DO $$ BEGIN
    ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_playerId_fkey"
        FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Pojistka: chybějící sloupec i tabulka by se projevily až trenérovi
-- při otevření rozborů.
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ReviewEventType'
          AND column_name = 'subLabel'
    ) THEN
        RAISE EXCEPTION 'Migrace zastavena: sloupec ReviewEventType.subLabel nevznikl';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ReviewComment'
    ) THEN
        RAISE EXCEPTION 'Migrace zastavena: tabulka ReviewComment nevznikla';
    END IF;
END $$;

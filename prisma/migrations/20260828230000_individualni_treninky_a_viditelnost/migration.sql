-- Individuální tréninky, skrytí starých plateb hráčům a vyřazení
-- vybraných hráčů z ratingu.
--
-- Psáno tak, aby šla pustit znovu — předchozí migrace zůstala rozdělaná
-- a nasazení se opakuje. Viz komentář v 20260828170000.

-- Hráčům se v jejich odkazu ukazují jen platby od tohohle dne.
-- Starší sezóna zůstává trenérovi ve výpisu.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "playerVisibleFrom" DATE;

-- Nová sezóna začíná v září; starší platby už hráče nezajímají.
-- Jen tam, kde hranice není — ručně posunutou by přepis vrátil zpátky.
UPDATE "User" SET "playerVisibleFrom" = DATE '2026-09-01'
WHERE "playerVisibleFrom" IS NULL;

-- Junioři, které trenér zatím do ratingu nepočítá.
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "inRating" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "SoloSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "performedOn" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoloSession_pkey" PRIMARY KEY ("id")
);

-- Jeden zápis na den. Rating za docházku má odměňovat pravidelnost,
-- ne to, kdo si nakliká víc řádků.
CREATE UNIQUE INDEX IF NOT EXISTS "SoloSession_playerId_performedOn_key"
    ON "SoloSession"("playerId", "performedOn");
CREATE INDEX IF NOT EXISTS "SoloSession_userId_performedOn_idx" ON "SoloSession"("userId", "performedOn");

DO $$ BEGIN
    ALTER TABLE "SoloSession" ADD CONSTRAINT "SoloSession_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "SoloSession" ADD CONSTRAINT "SoloSession_playerId_fkey"
        FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

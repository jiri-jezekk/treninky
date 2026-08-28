-- Individuální tréninky, skrytí starých plateb hráčům a vyřazení
-- vybraných hráčů z ratingu.

-- Hráčům se v jejich odkazu ukazují jen platby od tohohle dne.
-- Starší sezóna zůstává trenérovi ve výpisu.
ALTER TABLE "User" ADD COLUMN "playerVisibleFrom" DATE;

-- Nová sezóna začíná v září; starší platby už hráče nezajímají.
UPDATE "User" SET "playerVisibleFrom" = DATE '2026-09-01';

-- Junioři, které trenér zatím do ratingu nepočítá.
ALTER TABLE "Player" ADD COLUMN "inRating" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "SoloSession" (
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
CREATE UNIQUE INDEX "SoloSession_playerId_performedOn_key"
    ON "SoloSession"("playerId", "performedOn");
CREATE INDEX "SoloSession_userId_performedOn_idx" ON "SoloSession"("userId", "performedOn");

ALTER TABLE "SoloSession" ADD CONSTRAINT "SoloSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SoloSession" ADD CONSTRAINT "SoloSession_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rating, duely a měsíční výzvy.

CREATE TYPE "DuelStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REPORTED', 'CONFIRMED', 'DECLINED');
CREATE TYPE "RatingSource" AS ENUM ('DUEL', 'CHALLENGE', 'COACH');

-- Rating z duelů a výzev. Body za docházku se sem nepřičítají —
-- dopočítávají se, aby se srovnaly, když trenér účast dodatečně opraví.
ALTER TABLE "Player" ADD COLUMN "ratingPoints" INTEGER NOT NULL DEFAULT 1000;

CREATE TABLE "Discipline" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "higherWins" BOOLEAN NOT NULL DEFAULT true,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Discipline_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Discipline_userId_name_key" ON "Discipline"("userId", "name");
CREATE INDEX "Discipline_userId_archived_idx" ON "Discipline"("userId", "archived");

ALTER TABLE "Discipline" ADD CONSTRAINT "Discipline_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Duel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "disciplineId" TEXT NOT NULL,
    "challengerId" TEXT NOT NULL,
    "opponentId" TEXT NOT NULL,
    "status" "DuelStatus" NOT NULL DEFAULT 'PENDING',
    "challengerValue" DOUBLE PRECISION,
    "opponentValue" DOUBLE PRECISION,
    "reportedById" TEXT,
    "note" TEXT,
    "challengerDelta" INTEGER,
    "opponentDelta" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "Duel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Duel_userId_status_idx" ON "Duel"("userId", "status");
CREATE INDEX "Duel_challengerId_idx" ON "Duel"("challengerId");
CREATE INDEX "Duel_opponentId_idx" ON "Duel"("opponentId");

ALTER TABLE "Duel" ADD CONSTRAINT "Duel_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_disciplineId_fkey"
    FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_challengerId_fkey"
    FOREIGN KEY ("challengerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_opponentId_fkey"
    FOREIGN KEY ("opponentId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "disciplineId" TEXT,
    "unit" TEXT,
    "higherWins" BOOLEAN NOT NULL DEFAULT true,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Challenge_userId_endsOn_idx" ON "Challenge"("userId", "endsOn");

ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_disciplineId_fkey"
    FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ChallengeEntry" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeEntry_pkey" PRIMARY KEY ("id")
);

-- Jeden hráč, jeden zápis do výzvy — jinak by si šlo pořadí vylepšit opakováním.
CREATE UNIQUE INDEX "ChallengeEntry_challengeId_playerId_key"
    ON "ChallengeEntry"("challengeId", "playerId");
CREATE INDEX "ChallengeEntry_playerId_idx" ON "ChallengeEntry"("playerId");

ALTER TABLE "ChallengeEntry" ADD CONSTRAINT "ChallengeEntry_challengeId_fkey"
    FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChallengeEntry" ADD CONSTRAINT "ChallengeEntry_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RatingEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "source" "RatingSource" NOT NULL,
    "delta" INTEGER NOT NULL,
    "ratingAfter" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "duelId" TEXT,
    "challengeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RatingEntry_userId_createdAt_idx" ON "RatingEntry"("userId", "createdAt");
CREATE INDEX "RatingEntry_playerId_createdAt_idx" ON "RatingEntry"("playerId", "createdAt");

ALTER TABLE "RatingEntry" ADD CONSTRAINT "RatingEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RatingEntry" ADD CONSTRAINT "RatingEntry_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Disciplíny na začátek, ať je co vyzvat hned po nasazení.
-- Trenér si je přejmenuje, doplní nebo archivuje.
INSERT INTO "Discipline" ("id", "userId", "name", "description", "unit", "higherWins", "createdAt")
SELECT gen_random_uuid()::text, u."id", d.name, d.description, d.unit, d.higher, now()
FROM "User" u
CROSS JOIN (VALUES
    ('Hod na přesnost', 'Deset hodů na kužely nebo terč. Počítá se počet zásahů.', 'zásahů', true),
    ('Chytání', 'Deset hodů od soupeře. Počítá se, kolik jich chytíš.', 'chycených', true),
    ('Úhyby 1v1', 'Kdo déle vydrží bez zásahu.', 's', true),
    ('Člunkový běh', 'Sprint tam a zpět na čas.', 's', false)
) AS d(name, description, unit, higher);

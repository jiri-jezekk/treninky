-- Rekonstrukce produkčního stavu k 28. 8. 2026 podle výpisu z Neonu:
-- starší podoba ratingu, která se do databáze dostala mimo migrace
-- (přes `prisma db push`), a proto o ní `_prisma_migrations` neví.
-- Slouží k odladění migrace 20260828170000 proti reálnému stavu.

CREATE TYPE "DuelStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REPORTED', 'CONFIRMED', 'DECLINED');
CREATE TYPE "RatingSource" AS ENUM ('DUEL', 'MATCH', 'CHALLENGE', 'COACH');

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
CREATE INDEX "Discipline_userId_idx" ON "Discipline"("userId");
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

CREATE TABLE "ChallengeEntry" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChallengeEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChallengeEntry_challengeId_playerId_key" ON "ChallengeEntry"("challengeId", "playerId");
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

-- Data, která v produkci opravdu jsou: 8 disciplín, 1 duel, 2 zápisy ratingu.
INSERT INTO "Discipline" ("id","userId","name","unit","createdAt")
SELECT 'd'||g, 'u1', 'Disciplína '||g, 'm', now() FROM generate_series(1,8) g;
INSERT INTO "Duel" ("id","userId","disciplineId","challengerId","opponentId","status","challengerValue","opponentValue","challengerDelta","opponentDelta","createdAt","confirmedAt")
VALUES ('duel1','u1','d1','p1','p2','CONFIRMED',12,9,16,-16,now(),now());
INSERT INTO "RatingEntry" ("id","userId","playerId","source","delta","ratingAfter","label","duelId","createdAt")
VALUES ('re1','u1','p1','DUEL',16,1016,'Duel: Disciplína 1','duel1',now()),
       ('re2','u1','p2','DUEL',-16,984,'Duel: Disciplína 1','duel1',now());
UPDATE "Player" SET "ratingPoints" = 1016 WHERE id='p1';
UPDATE "Player" SET "ratingPoints" = 984 WHERE id='p2';

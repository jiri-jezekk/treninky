-- Ratingové sezóny, váhy akcí a tréninky v posilovně.

CREATE TYPE "TrainingKind" AS ENUM ('TRAINING', 'GYM');

ALTER TABLE "Training" ADD COLUMN "kind" "TrainingKind" NOT NULL DEFAULT 'TRAINING';
ALTER TABLE "TrainingSlot" ADD COLUMN "kind" "TrainingKind" NOT NULL DEFAULT 'TRAINING';

-- Váha akce v procentech; 100 = běžný duel.
ALTER TABLE "Discipline" ADD COLUMN "weightPercent" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "Challenge" ADD COLUMN "weightPercent" INTEGER NOT NULL DEFAULT 150;

CREATE TABLE "RatingSeason" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingSeason_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RatingSeason_userId_name_key" ON "RatingSeason"("userId", "name");
CREATE INDEX "RatingSeason_userId_startsOn_idx" ON "RatingSeason"("userId", "startsOn");

ALTER TABLE "RatingSeason" ADD CONSTRAINT "RatingSeason_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PlayerRating" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1000,

    CONSTRAINT "PlayerRating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerRating_seasonId_playerId_key"
    ON "PlayerRating"("seasonId", "playerId");
CREATE INDEX "PlayerRating_playerId_idx" ON "PlayerRating"("playerId");

ALTER TABLE "PlayerRating" ADD CONSTRAINT "PlayerRating_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "RatingSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerRating" ADD CONSTRAINT "PlayerRating_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Běžící sezóna. Rating se sbírá do konce května — předplacené období
-- končí až v červnu, proto je to vlastní číselník.
INSERT INTO "RatingSeason" ("id", "userId", "name", "startsOn", "endsOn", "createdAt")
SELECT gen_random_uuid()::text, u."id", 'Sezóna 2026/27', DATE '2026-08-01', DATE '2027-05-31', now()
FROM "User" u;

-- Všichni začínají stejně.
INSERT INTO "PlayerRating" ("id", "seasonId", "playerId", "points")
SELECT gen_random_uuid()::text, s."id", p."id", 1000
FROM "Player" p
JOIN "RatingSeason" s ON s."userId" = p."userId";

-- Duely, výzvy a historie patří do sezóny.
ALTER TABLE "Duel" ADD COLUMN "seasonId" TEXT;
ALTER TABLE "Challenge" ADD COLUMN "seasonId" TEXT;
ALTER TABLE "RatingEntry" ADD COLUMN "seasonId" TEXT;

UPDATE "Duel" d SET "seasonId" = s."id"
FROM "RatingSeason" s WHERE s."userId" = d."userId";
UPDATE "Challenge" c SET "seasonId" = s."id"
FROM "RatingSeason" s WHERE s."userId" = c."userId";
UPDATE "RatingEntry" e SET "seasonId" = s."id"
FROM "RatingSeason" s WHERE s."userId" = e."userId";

-- Nic nesmí zůstat bez sezóny, jinak by to z žebříčku vypadlo.
DO $$
DECLARE orphans INTEGER;
BEGIN
    SELECT
        (SELECT count(*) FROM "Duel" WHERE "seasonId" IS NULL)
      + (SELECT count(*) FROM "Challenge" WHERE "seasonId" IS NULL)
      + (SELECT count(*) FROM "RatingEntry" WHERE "seasonId" IS NULL)
    INTO orphans;
    IF orphans > 0 THEN
        RAISE EXCEPTION 'Migrace zastavena: % záznamů se nepodařilo napárovat na sezónu', orphans;
    END IF;
END $$;

ALTER TABLE "Duel" ALTER COLUMN "seasonId" SET NOT NULL;
ALTER TABLE "Challenge" ALTER COLUMN "seasonId" SET NOT NULL;
ALTER TABLE "RatingEntry" ALTER COLUMN "seasonId" SET NOT NULL;

ALTER TABLE "Duel" ADD CONSTRAINT "Duel_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "RatingSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "RatingSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RatingEntry" ADD CONSTRAINT "RatingEntry_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "RatingSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rating se přestěhoval do PlayerRating; reset na 1000 je záměr,
-- sezóna začíná teď a všichni mají stejně.
ALTER TABLE "Player" DROP COLUMN "ratingPoints";

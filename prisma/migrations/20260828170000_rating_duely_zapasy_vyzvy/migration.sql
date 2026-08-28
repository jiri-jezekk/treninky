-- Rating: sezóny, duely, zápasy týmů a měsíční výzvy.
--
-- Tři váhy: duel 100 %, zápas 150 %, měsíční výzva 200 %. U každého
-- se dá přepsat. Disciplíny jako číselník tu schválně nejsou —
-- hráči si duel pojmenují sami.
--
-- POZOR, proč je celý skript psaný „když už to tam je, nevadí“:
-- předchozí nasazení skončilo v půlce (P3018, „type DuelStatus already
-- exists“) a databáze zůstala v mezistavu — část objektů vznikla, část ne.
-- Skript proto musí projít v obou případech: na prázdné databázi
-- i na té rozdělané. Každý krok se ptá, jestli už hotový není.
-- Vkládaná data mají stejnou pojistku, aby sezóna a ratingy nevznikly
-- podruhé a aby se nepřepsalo, co už je odehrané.

DO $$ BEGIN
    CREATE TYPE "DuelStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REPORTED', 'CONFIRMED', 'DECLINED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "RatingSource" AS ENUM ('DUEL', 'MATCH', 'CHALLENGE', 'COACH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "TrainingKind" AS ENUM ('TRAINING', 'GYM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Posilovna se počítá do ratingu, ale neúčtuje se.
ALTER TABLE "Training" ADD COLUMN IF NOT EXISTS "kind" "TrainingKind" NOT NULL DEFAULT 'TRAINING';
ALTER TABLE "TrainingSlot" ADD COLUMN IF NOT EXISTS "kind" "TrainingKind" NOT NULL DEFAULT 'TRAINING';

CREATE TABLE IF NOT EXISTS "RatingSeason" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingSeason_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RatingSeason_userId_name_key" ON "RatingSeason"("userId", "name");
CREATE INDEX IF NOT EXISTS "RatingSeason_userId_startsOn_idx" ON "RatingSeason"("userId", "startsOn");

DO $$ BEGIN
    ALTER TABLE "RatingSeason" ADD CONSTRAINT "RatingSeason_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PlayerRating" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1000,

    CONSTRAINT "PlayerRating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlayerRating_seasonId_playerId_key" ON "PlayerRating"("seasonId", "playerId");
CREATE INDEX IF NOT EXISTS "PlayerRating_playerId_idx" ON "PlayerRating"("playerId");

DO $$ BEGIN
    ALTER TABLE "PlayerRating" ADD CONSTRAINT "PlayerRating_seasonId_fkey"
        FOREIGN KEY ("seasonId") REFERENCES "RatingSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PlayerRating" ADD CONSTRAINT "PlayerRating_playerId_fkey"
        FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Duel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "higherWins" BOOLEAN NOT NULL DEFAULT true,
    "weightPercent" INTEGER NOT NULL DEFAULT 100,
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

CREATE INDEX IF NOT EXISTS "Duel_userId_status_idx" ON "Duel"("userId", "status");
CREATE INDEX IF NOT EXISTS "Duel_seasonId_idx" ON "Duel"("seasonId");
CREATE INDEX IF NOT EXISTS "Duel_challengerId_idx" ON "Duel"("challengerId");
CREATE INDEX IF NOT EXISTS "Duel_opponentId_idx" ON "Duel"("opponentId");

DO $$ BEGIN
    ALTER TABLE "Duel" ADD CONSTRAINT "Duel_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Duel" ADD CONSTRAINT "Duel_seasonId_fkey"
        FOREIGN KEY ("seasonId") REFERENCES "RatingSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Duel" ADD CONSTRAINT "Duel_challengerId_fkey"
        FOREIGN KEY ("challengerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Duel" ADD CONSTRAINT "Duel_opponentId_fkey"
        FOREIGN KEY ("opponentId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Match" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "weightPercent" INTEGER NOT NULL DEFAULT 150,
    "playedOn" DATE NOT NULL,
    "trainingId" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Match_userId_playedOn_idx" ON "Match"("userId", "playedOn");
CREATE INDEX IF NOT EXISTS "Match_seasonId_idx" ON "Match"("seasonId");

DO $$ BEGIN
    ALTER TABLE "Match" ADD CONSTRAINT "Match_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Match" ADD CONSTRAINT "Match_seasonId_fkey"
        FOREIGN KEY ("seasonId") REFERENCES "RatingSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Smazaný trénink nesmí vzít s sebou zápas, jehož rating už je rozdaný.
DO $$ BEGIN
    ALTER TABLE "Match" ADD CONSTRAINT "Match_trainingId_fkey"
        FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MatchTeam" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "delta" INTEGER,

    CONSTRAINT "MatchTeam_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MatchTeam_matchId_idx" ON "MatchTeam"("matchId");

DO $$ BEGIN
    ALTER TABLE "MatchTeam" ADD CONSTRAINT "MatchTeam_matchId_fkey"
        FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MatchTeamMember" (
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "MatchTeamMember_pkey" PRIMARY KEY ("teamId", "playerId")
);

CREATE INDEX IF NOT EXISTS "MatchTeamMember_playerId_idx" ON "MatchTeamMember"("playerId");

DO $$ BEGIN
    ALTER TABLE "MatchTeamMember" ADD CONSTRAINT "MatchTeamMember_teamId_fkey"
        FOREIGN KEY ("teamId") REFERENCES "MatchTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "MatchTeamMember" ADD CONSTRAINT "MatchTeamMember_playerId_fkey"
        FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Challenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "higherWins" BOOLEAN NOT NULL DEFAULT true,
    "weightPercent" INTEGER NOT NULL DEFAULT 200,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Challenge_userId_endsOn_idx" ON "Challenge"("userId", "endsOn");
CREATE INDEX IF NOT EXISTS "Challenge_seasonId_idx" ON "Challenge"("seasonId");

DO $$ BEGIN
    ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_seasonId_fkey"
        FOREIGN KEY ("seasonId") REFERENCES "RatingSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ChallengeEntry" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeEntry_pkey" PRIMARY KEY ("id")
);

-- Jeden hráč, jeden zápis — jinak by si šlo pořadí vylepšit opakováním.
CREATE UNIQUE INDEX IF NOT EXISTS "ChallengeEntry_challengeId_playerId_key" ON "ChallengeEntry"("challengeId", "playerId");
CREATE INDEX IF NOT EXISTS "ChallengeEntry_playerId_idx" ON "ChallengeEntry"("playerId");

DO $$ BEGIN
    ALTER TABLE "ChallengeEntry" ADD CONSTRAINT "ChallengeEntry_challengeId_fkey"
        FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ChallengeEntry" ADD CONSTRAINT "ChallengeEntry_playerId_fkey"
        FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RatingEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "source" "RatingSource" NOT NULL,
    "delta" INTEGER NOT NULL,
    "ratingAfter" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "duelId" TEXT,
    "matchId" TEXT,
    "challengeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RatingEntry_userId_createdAt_idx" ON "RatingEntry"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "RatingEntry_seasonId_createdAt_idx" ON "RatingEntry"("seasonId", "createdAt");
CREATE INDEX IF NOT EXISTS "RatingEntry_playerId_createdAt_idx" ON "RatingEntry"("playerId", "createdAt");

DO $$ BEGIN
    ALTER TABLE "RatingEntry" ADD CONSTRAINT "RatingEntry_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RatingEntry" ADD CONSTRAINT "RatingEntry_seasonId_fkey"
        FOREIGN KEY ("seasonId") REFERENCES "RatingSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RatingEntry" ADD CONSTRAINT "RatingEntry_playerId_fkey"
        FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Běžící sezóna. Rating se sbírá do konce května — předplacené období
-- končí až v červnu, proto je to vlastní číselník.
-- Když sezóna toho jména existuje, nechává se, jak je: mohla v ní
-- být posunutá hranice nebo už rozdaný rating.
INSERT INTO "RatingSeason" ("id", "userId", "name", "startsOn", "endsOn", "createdAt")
SELECT gen_random_uuid()::text, u."id", 'Sezóna 2026/27', DATE '2026-08-01', DATE '2027-05-31', now()
FROM "User" u
WHERE NOT EXISTS (
    SELECT 1 FROM "RatingSeason" s
    WHERE s."userId" = u."id" AND s."name" = 'Sezóna 2026/27'
);

-- Všichni začínají stejně. Kdo rating v té sezóně už má, ten si ho
-- ponechá — přepsat ho na 1000 by smazalo odehrané duely.
INSERT INTO "PlayerRating" ("id", "seasonId", "playerId", "points")
SELECT gen_random_uuid()::text, s."id", p."id", 1000
FROM "Player" p
JOIN "RatingSeason" s ON s."userId" = p."userId"
WHERE NOT EXISTS (
    SELECT 1 FROM "PlayerRating" r
    WHERE r."seasonId" = s."id" AND r."playerId" = p."id"
);

-- Pojistka: každý hráč musí mít rating v každé sezóně svého klubu.
DO $$
DECLARE chybejici INTEGER;
BEGIN
    SELECT count(*) INTO chybejici
    FROM "Player" p
    JOIN "RatingSeason" s ON s."userId" = p."userId"
    LEFT JOIN "PlayerRating" r ON r."seasonId" = s."id" AND r."playerId" = p."id"
    WHERE r."id" IS NULL;

    IF chybejici > 0 THEN
        RAISE EXCEPTION 'Migrace zastavena: % hráčům chybí rating', chybejici;
    END IF;
END $$;

-- Předplacená sezóna: z přepínače na období od–do.
--
-- Dosud byl na hráči boolean `prepaidSeason`. Ten platil zpětně i dopředu:
-- zaškrtnutím v listopadu zmizely hráči z plateb i září a říjen. Teď je
-- předplatné záznam s vlastním obdobím, takže loňské platby zůstávají
-- nedotčené, když si hráč předplatí letošní sezónu.

CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "defaultPriceCents" INTEGER,
    "incomeKind" "IncomeKind" NOT NULL DEFAULT 'TRAINING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Season_userId_name_key" ON "Season"("userId", "name");
CREATE UNIQUE INDEX "Season_userId_number_key" ON "Season"("userId", "number");
CREATE INDEX "Season_userId_startsOn_idx" ON "Season"("userId", "startsOn");

ALTER TABLE "Season" ADD CONSTRAINT "Season_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Prepayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "seasonId" TEXT,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "vs" TEXT NOT NULL,
    "incomeKind" "IncomeKind" NOT NULL DEFAULT 'TRAINING',
    "note" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prepayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Prepayment_vs_key" ON "Prepayment"("vs");
-- Jeden hráč má na jednu sezónu nejvýš jedno předplatné. Ruční období
-- (seasonId IS NULL) tenhle index neomezuje — Postgres bere NULLy jako různé.
CREATE UNIQUE INDEX "Prepayment_playerId_seasonId_key" ON "Prepayment"("playerId", "seasonId");
CREATE INDEX "Prepayment_userId_startsOn_idx" ON "Prepayment"("userId", "startsOn");
CREATE INDEX "Prepayment_playerId_idx" ON "Prepayment"("playerId");

ALTER TABLE "Prepayment" ADD CONSTRAINT "Prepayment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Prepayment" ADD CONSTRAINT "Prepayment_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Prepayment" ADD CONSTRAINT "Prepayment_seasonId_fkey"
    FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Číslo hráče je součástí variabilního symbolu a musí se vejít do čtyř míst.
DO $$
DECLARE too_big INTEGER;
BEGIN
    SELECT count(*) INTO too_big
    FROM "Player" WHERE "prepaidSeason" = true AND "number" > 9999;
    IF too_big > 0 THEN
        RAISE EXCEPTION 'Migrace zastavena: % předplacených hráčů má číslo nad 9999, variabilní symbol by přetekl', too_big;
    END IF;
END $$;

-- Výchozí sezóna, ať je kam předplatné pověsit. Trenér si ji přejmenuje.
INSERT INTO "Season" ("id", "userId", "name", "number", "startsOn", "endsOn", "incomeKind", "createdAt")
SELECT gen_random_uuid()::text, u."id", 'Sezóna 2026/27', 1, DATE '2026-09-01', DATE '2027-06-30', 'TRAINING', now()
FROM "User" u;

-- Převod starého přepínače. `startsOn` sahá až k prvnímu odchozenému
-- tréninku hráče, aby se z dosud neúčtovaných měsíců nestal přes noc dluh.
INSERT INTO "Prepayment" (
    "id", "userId", "playerId", "seasonId", "startsOn", "endsOn",
    "amountCents", "vs", "incomeKind", "note", "paidAt", "createdAt"
)
SELECT
    gen_random_uuid()::text,
    p."userId",
    p."id",
    s."id",
    LEAST(
        s."startsOn",
        COALESCE(
            (SELECT MIN(t."startsAt")::date
             FROM "Attendance" a
             JOIN "Training" t ON t."id" = a."trainingId"
             WHERE a."playerId" = p."id" AND a."status" = 'PRESENT'),
            s."startsOn"
        )
    ),
    s."endsOn",
    0,
    '4' || lpad(p."number"::text, 4, '0') || '01',
    'TRAINING',
    'Převedeno z dřívějšího přepínače Předplaceno — zkontroluj datum od.',
    now(),
    now()
FROM "Player" p
JOIN "Season" s ON s."userId" = p."userId" AND s."number" = 1
WHERE p."prepaidSeason" = true;

-- Nikdo se nesmí cestou ztratit.
DO $$
DECLARE expected INTEGER; got INTEGER;
BEGIN
    SELECT count(*) INTO expected FROM "Player" WHERE "prepaidSeason" = true;
    SELECT count(*) INTO got FROM "Prepayment";
    IF got <> expected THEN
        RAISE EXCEPTION 'Migrace zastavena: očekáváno % předplatných, vzniklo %', expected, got;
    END IF;
END $$;

ALTER TABLE "Player" DROP COLUMN "prepaidSeason";

-- Souhrnná platba si musí pamatovat i předplatné, jinak se její otisk
-- nepřečte zpátky a při každém otevření odkazu by vznikala nová.
ALTER TABLE "PaymentBatchItem" ADD COLUMN "prepaymentId" TEXT;

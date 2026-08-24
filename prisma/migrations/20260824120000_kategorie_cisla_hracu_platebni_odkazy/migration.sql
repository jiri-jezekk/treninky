-- ============================================================================
-- Migrace: editovatelné kategorie, čísla hráčů, platební odkazy, typy příjmů
-- ============================================================================
-- Běží v jedné transakci. Když cokoli selže, nezmění se nic.

-- ---------------------------------------------------------------- 1. Kategorie
CREATE TABLE "Group" (
    "id"                 TEXT NOT NULL,
    "userId"             TEXT NOT NULL,
    "name"               TEXT NOT NULL,
    "color"              TEXT NOT NULL DEFAULT '#0ea5e9',
    "sortOrder"          INTEGER NOT NULL DEFAULT 0,
    -- Není-li NULL, hráči v této kategorii platí tuto cenu za trénink
    -- místo běžné sazby. Sem se stěhuje dosavadní pravidlo „junioři 60 Kč“.
    "discountPriceCents" INTEGER,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Group_userId_name_key" ON "Group"("userId","name");
CREATE INDEX "Group_userId_idx" ON "Group"("userId");
ALTER TABLE "Group" ADD CONSTRAINT "Group_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ze čtyř hodnot enumu udělej řádky, pro každého uživatele zvlášť.
INSERT INTO "Group" ("id","userId","name","color","sortOrder","discountPriceCents")
SELECT 'grp_' || substr(md5(u."id" || g.code), 1, 20),
       u."id", g.label, g.color, g.ord, g.disc
FROM "User" u
CROSS JOIN (VALUES
    ('MEN',     'Muži',    '#0ea5e9', 0, NULL::int),
    ('WOMEN',   'Ženy',    '#fb7185', 1, NULL),
    ('MIX',     'Mix',     '#2dd4bf', 2, NULL),
    ('JUNIORS', 'Junioři', '#f97316', 3, 6000)
) AS g(code,label,color,ord,disc);

-- ------------------------------------------------- 2. Členství: enum -> groupId
ALTER TABLE "PlayerGroupMembership" ADD COLUMN "groupId" TEXT;

UPDATE "PlayerGroupMembership" m
SET "groupId" = gr."id"
FROM "Player" p, "Group" gr
WHERE m."playerId" = p."id"
  AND gr."userId" = p."userId"
  AND gr."name" = CASE m."group"::text
        WHEN 'MEN'     THEN 'Muži'
        WHEN 'WOMEN'   THEN 'Ženy'
        WHEN 'MIX'     THEN 'Mix'
        WHEN 'JUNIORS' THEN 'Junioři'
      END;

-- Pojistka: kdyby se nějaké členství nespárovalo, migrace tady spadne
-- a transakce se vrátí zpět. Radši chyba než tiše ztracená data.
DO $$
DECLARE orphans INTEGER;
BEGIN
    SELECT count(*) INTO orphans FROM "PlayerGroupMembership" WHERE "groupId" IS NULL;
    IF orphans > 0 THEN
        RAISE EXCEPTION 'Migrace zastavena: % členství se nepodařilo napárovat na kategorii', orphans;
    END IF;
END $$;

ALTER TABLE "PlayerGroupMembership" DROP CONSTRAINT "PlayerGroupMembership_pkey";
ALTER TABLE "PlayerGroupMembership" ALTER COLUMN "groupId" SET NOT NULL;
ALTER TABLE "PlayerGroupMembership" ADD CONSTRAINT "PlayerGroupMembership_pkey"
    PRIMARY KEY ("playerId","groupId");
ALTER TABLE "PlayerGroupMembership" DROP COLUMN "group";
ALTER TABLE "PlayerGroupMembership" ADD CONSTRAINT "PlayerGroupMembership_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "PlayerGroupMembership_groupId_idx" ON "PlayerGroupMembership"("groupId");

DROP TYPE "PlayerGroup";

-- --------------------------------- 3. Hráč: číslo, platební odkaz, heslo k němu
ALTER TABLE "Player" ADD COLUMN "number"        INTEGER;
ALTER TABLE "Player" ADD COLUMN "payToken"      TEXT;
ALTER TABLE "Player" ADD COLUMN "passwordHash"  TEXT;
ALTER TABLE "Player" ADD COLUMN "passwordSetAt" TIMESTAMP(3);

-- Čísla podle abecedy, v rámci každého uživatele od jedničky.
WITH numbered AS (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "name", "id") AS rn
    FROM "Player"
)
UPDATE "Player" p SET "number" = n.rn FROM numbered n WHERE p."id" = n."id";

-- Náhodný token pro veřejný odkaz. 18 hex znaků = dost na to, aby se neuhodl.
UPDATE "Player"
SET "payToken" = substr(md5(random()::text || clock_timestamp()::text || "id"), 1, 18)
WHERE "payToken" IS NULL;

ALTER TABLE "Player" ALTER COLUMN "number"   SET NOT NULL;
ALTER TABLE "Player" ALTER COLUMN "payToken" SET NOT NULL;
CREATE UNIQUE INDEX "Player_payToken_key"     ON "Player"("payToken");
CREATE UNIQUE INDEX "Player_userId_number_key" ON "Player"("userId","number");

-- ------------------------------------------------------------- 4. Typy příjmů
CREATE TYPE "IncomeKind" AS ENUM ('MEMBERSHIP','TRAINING','EVENT','GOODS','OTHER');

ALTER TABLE "SharedPayment" ADD COLUMN "incomeKind" "IncomeKind" NOT NULL DEFAULT 'EVENT';

-- Pořadové číslo akce v rámci klubu — druhá část variabilního symbolu.
ALTER TABLE "SharedPayment" ADD COLUMN "number" INTEGER;
WITH numbered AS (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt", "id") AS rn
    FROM "SharedPayment"
)
UPDATE "SharedPayment" s SET "number" = n.rn FROM numbered n WHERE s."id" = n."id";
ALTER TABLE "SharedPayment" ALTER COLUMN "number" SET NOT NULL;
CREATE UNIQUE INDEX "SharedPayment_userId_number_key" ON "SharedPayment"("userId","number");
ALTER TABLE "User" ADD COLUMN "monthlyIncomeKind" "IncomeKind" NOT NULL DEFAULT 'TRAINING';
ALTER TABLE "User" ADD COLUMN "clubName" TEXT;
ALTER TABLE "User" ADD COLUMN "clubIco"  TEXT;

-- ------------------------------------- 5. Souhrnná platba a její rozpad položek
CREATE TABLE "PaymentBatch" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "playerId"   TEXT NOT NULL,
    "vs"         TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt"     TIMESTAMP(3),
    CONSTRAINT "PaymentBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentBatch_vs_key" ON "PaymentBatch"("vs");
CREATE INDEX "PaymentBatch_userId_createdAt_idx" ON "PaymentBatch"("userId","createdAt");
ALTER TABLE "PaymentBatch" ADD CONSTRAINT "PaymentBatch_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentBatch" ADD CONSTRAINT "PaymentBatch_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rozpad souhrnné platby: co všechno ta jedna částka pokrývá.
-- Právě tohle dělá souhrnnou platbu doložitelnou pro účetní.
CREATE TABLE "PaymentBatchItem" (
    "id"              TEXT NOT NULL,
    "batchId"         TEXT NOT NULL,
    "kind"            "IncomeKind" NOT NULL,
    "label"           TEXT NOT NULL,
    "amountCents"     INTEGER NOT NULL,
    "year"            INTEGER,
    "month"           INTEGER,
    "sharedPaymentId" TEXT,
    CONSTRAINT "PaymentBatchItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PaymentBatchItem_batchId_idx" ON "PaymentBatchItem"("batchId");
ALTER TABLE "PaymentBatchItem" ADD CONSTRAINT "PaymentBatchItem_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "PaymentBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Plánovač tréninků.
--
-- Plán tréninku je nově samostatný záznam (TrainingPlan). Dřív visely
-- body plánu přímo na tréninku z rozvrhu, jenže děti a junioři v aplikaci
-- rozvrh, docházku ani platby nemají — plánovat se pro ně nedalo.
--
-- Stávající body se přestěhují: každý trénink, který měl plán, dostane
-- TrainingPlan navázaný na sebe (id „tp_<id tréninku>“, ať je opakované
-- spuštění poznat) a body se na něj přepojí. Nic se nemaže.
--
-- Knihovna cvičení dostává zaměření, kategorie, štítky, minimální počet
-- hráčů a odkaz.
--
-- Druhy cvičení se mění na části tréninku tak, jak je trenér píše do
-- deníku: rozcvička, pohybová hra, herní cvičení, průpravná hra,
-- průpravné cvičení, závěrečné uvolnění. Dřívější „Cvičení“ se stává
-- herním cvičením a „Hra“ průpravnou hrou.
--
-- Psáno tak, aby šlo pustit znovu; viz README ve složce migrací.

-- Plán tréninku ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS "TrainingPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER,
    "groupId" TEXT,
    "topic" TEXT,
    "trainingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TrainingPlan_trainingId_key" ON "TrainingPlan"("trainingId");

CREATE INDEX IF NOT EXISTS "TrainingPlan_userId_startsAt_idx" ON "TrainingPlan"("userId", "startsAt");

DO $$ BEGIN
    ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Knihovna cvičení ------------------------------------------------------

ALTER TABLE "Drill" ADD COLUMN IF NOT EXISTS "focus" TEXT;
ALTER TABLE "Drill" ADD COLUMN IF NOT EXISTS "groupIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Drill" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Drill" ADD COLUMN IF NOT EXISTS "minPlayers" INTEGER;
ALTER TABLE "Drill" ADD COLUMN IF NOT EXISTS "link" TEXT;

-- Body plánu ------------------------------------------------------------

ALTER TABLE "TrainingBlock" ADD COLUMN IF NOT EXISTS "focus" TEXT;
ALTER TABLE "TrainingBlock" ADD COLUMN IF NOT EXISTS "planId" TEXT;

-- Přestěhování bodů z tréninku na plán. Jen dokud sloupec trainingId
-- existuje — po úspěšném běhu už není odkud stěhovat.
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'TrainingBlock'
          AND column_name = 'trainingId'
    ) THEN
        -- Tréninky z rozvrhu jsou dospělí: kategorie se doplní, má-li
        -- trenér kategorii „A-tým“. Jinak zůstane prázdná.
        EXECUTE $sql$
            INSERT INTO "TrainingPlan" ("id", "userId", "startsAt", "durationMinutes", "groupId", "trainingId", "createdAt", "updatedAt")
            SELECT
                'tp_' || t."id",
                t."userId",
                t."startsAt",
                CASE
                    WHEN t."endsAt" IS NULL THEN NULL
                    ELSE ROUND(EXTRACT(EPOCH FROM (t."endsAt" - t."startsAt")) / 60)::INTEGER
                END,
                (
                    SELECT g."id" FROM "Group" g
                    WHERE g."userId" = t."userId"
                      AND lower(replace(g."name", ' ', '-')) IN ('a-tým', 'a-tym')
                    ORDER BY g."sortOrder"
                    LIMIT 1
                ),
                t."id",
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            FROM "Training" t
            WHERE EXISTS (SELECT 1 FROM "TrainingBlock" b WHERE b."trainingId" = t."id")
              AND NOT EXISTS (SELECT 1 FROM "TrainingPlan" p WHERE p."trainingId" = t."id")
        $sql$;

        EXECUTE $sql$
            UPDATE "TrainingBlock" b
            SET "planId" = p."id"
            FROM "TrainingPlan" p
            WHERE p."trainingId" = b."trainingId"
              AND b."planId" IS NULL
        $sql$;
    END IF;
END $$;

-- Kontrola: žádný bod nesmí zůstat bez plánu.
DO $$
DECLARE orphans INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphans FROM "TrainingBlock" WHERE "planId" IS NULL;
    IF orphans > 0 THEN
        RAISE EXCEPTION 'Plánovač: % bodů plánu zůstalo bez plánu', orphans;
    END IF;
END $$;

ALTER TABLE "TrainingBlock" ALTER COLUMN "planId" SET NOT NULL;

ALTER TABLE "TrainingBlock" DROP CONSTRAINT IF EXISTS "TrainingBlock_trainingId_fkey";
DROP INDEX IF EXISTS "TrainingBlock_trainingId_sortOrder_idx";
ALTER TABLE "TrainingBlock" DROP COLUMN IF EXISTS "trainingId";

CREATE INDEX IF NOT EXISTS "TrainingBlock_planId_sortOrder_idx" ON "TrainingBlock"("planId", "sortOrder");

DO $$ BEGIN
    ALTER TABLE "TrainingBlock" ADD CONSTRAINT "TrainingBlock_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Druhy cvičení ---------------------------------------------------------

-- Postgres neumí hodnotu výčtu přejmenovat ani odebrat a novou hodnotu
-- nedovolí použít v téže transakci, ve které vznikla. Proto přes text:
-- sloupce se převedou na TEXT, výčet se založí znovu a hodnoty se vrátí.
-- Jen dokud výčet obsahuje starou hodnotu DRILL — opakovaný běh nic nedělá.
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'DrillKind' AND e.enumlabel = 'DRILL'
    ) THEN
        ALTER TABLE "Drill" ALTER COLUMN "kind" DROP DEFAULT;
        ALTER TABLE "TrainingBlock" ALTER COLUMN "kind" DROP DEFAULT;
        ALTER TABLE "Drill" ALTER COLUMN "kind" TYPE TEXT USING "kind"::TEXT;
        ALTER TABLE "TrainingBlock" ALTER COLUMN "kind" TYPE TEXT USING "kind"::TEXT;

        DROP TYPE "DrillKind";
        CREATE TYPE "DrillKind" AS ENUM ('WARMUP', 'MOVEMENT_GAME', 'GAME_DRILL', 'PREP_GAME', 'PREP_DRILL', 'COOLDOWN');

        UPDATE "Drill" SET "kind" = CASE "kind" WHEN 'DRILL' THEN 'GAME_DRILL' WHEN 'GAME' THEN 'PREP_GAME' ELSE "kind" END;
        UPDATE "TrainingBlock" SET "kind" = CASE "kind" WHEN 'DRILL' THEN 'GAME_DRILL' WHEN 'GAME' THEN 'PREP_GAME' ELSE "kind" END;

        ALTER TABLE "Drill" ALTER COLUMN "kind" TYPE "DrillKind" USING "kind"::"DrillKind";
        ALTER TABLE "TrainingBlock" ALTER COLUMN "kind" TYPE "DrillKind" USING "kind"::"DrillKind";
        ALTER TABLE "Drill" ALTER COLUMN "kind" SET DEFAULT 'GAME_DRILL';
        ALTER TABLE "TrainingBlock" ALTER COLUMN "kind" SET DEFAULT 'GAME_DRILL';
    END IF;
END $$;

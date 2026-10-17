-- Šablony tréninků, hodnocení bodů a poznámka po tréninku.
--
-- Šablona je předloha stavby hodiny pro kategorii; body nese jako JSON.
-- U bodu plánu jde po tréninku označit, jestli fungoval (1 / -1), a plán
-- má poznámku, která se ukáže u dalšího plánu stejné kategorie.
--
-- Psáno tak, aby šlo pustit znovu; viz README ve složce migrací.

ALTER TABLE "TrainingPlan" ADD COLUMN IF NOT EXISTS "reflection" TEXT;

ALTER TABLE "TrainingBlock" ADD COLUMN IF NOT EXISTS "rating" INTEGER;

CREATE TABLE IF NOT EXISTS "PlanTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupId" TEXT,
    "durationMinutes" INTEGER,
    "blocks" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlanTemplate_userId_idx" ON "PlanTemplate"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "PlanTemplate_userId_name_key" ON "PlanTemplate"("userId", "name");

DO $$ BEGIN
    ALTER TABLE "PlanTemplate" ADD CONSTRAINT "PlanTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PlanTemplate" ADD CONSTRAINT "PlanTemplate_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

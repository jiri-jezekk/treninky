-- Plánovač tréninků: knihovna cvičení a plán u jednotlivého tréninku.

CREATE TYPE "DrillKind" AS ENUM ('WARMUP', 'DRILL', 'GAME', 'COOLDOWN');

CREATE TABLE "Drill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultMinutes" INTEGER,
    "kind" "DrillKind" NOT NULL DEFAULT 'DRILL',
    "equipment" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Drill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Drill_userId_name_key" ON "Drill"("userId", "name");
CREATE INDEX "Drill_userId_archived_idx" ON "Drill"("userId", "archived");

ALTER TABLE "Drill" ADD CONSTRAINT "Drill_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TrainingBlock" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "drillId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "minutes" INTEGER NOT NULL,
    "kind" "DrillKind" NOT NULL DEFAULT 'DRILL',
    "sortOrder" INTEGER NOT NULL,
    "teams" JSONB,

    CONSTRAINT "TrainingBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrainingBlock_trainingId_sortOrder_idx"
    ON "TrainingBlock"("trainingId", "sortOrder");

ALTER TABLE "TrainingBlock" ADD CONSTRAINT "TrainingBlock_trainingId_fkey"
    FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Smazané cvičení nesmí vzít s sebou plán, ve kterém už bylo použité.
ALTER TABLE "TrainingBlock" ADD CONSTRAINT "TrainingBlock_drillId_fkey"
    FOREIGN KEY ("drillId") REFERENCES "Drill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

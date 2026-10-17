-- Soupisky kategorií pro dělení do týmů.
--
-- Každá kategorie (U12, U15…) má vlastní soupisku se jménem a dovedností
-- 1–3, nezávislou na hráčích klubu a platbách. U plánu se pamatuje, kdo
-- z ní na trénink přišel; z těch se dělí vyrovnané týmy.
--
-- Psáno tak, aby šlo pustit znovu; viz README ve složce migrací.

CREATE TABLE IF NOT EXISTS "RosterMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "skill" INTEGER NOT NULL DEFAULT 2,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RosterMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RosterMember_userId_groupId_idx" ON "RosterMember"("userId", "groupId");

CREATE UNIQUE INDEX IF NOT EXISTS "RosterMember_groupId_name_key" ON "RosterMember"("groupId", "name");

DO $$ BEGIN
    ALTER TABLE "RosterMember" ADD CONSTRAINT "RosterMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RosterMember" ADD CONSTRAINT "RosterMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "TrainingPlan" ADD COLUMN IF NOT EXISTS "attendeeIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

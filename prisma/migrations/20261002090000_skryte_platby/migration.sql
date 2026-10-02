-- Platby, které trenér hráči zatím neukazuje.
--
-- Hráč dluží tréninky za dva měsíce a ubytování, trenér ale chce, aby
-- teď zaplatil jen ubytování. Skrytá položka zůstává dluhem, jen ji
-- hráč nevidí v odkazu a nezaplatí ji souhrnnou platbou.
--
-- Psáno tak, aby šlo pustit znovu; viz README ve složce migrací.

CREATE TABLE IF NOT EXISTS "HiddenPaymentItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiddenPaymentItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HiddenPaymentItem_userId_idx" ON "HiddenPaymentItem"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "HiddenPaymentItem_playerId_key_key" ON "HiddenPaymentItem"("playerId", "key");

DO $$ BEGIN
    ALTER TABLE "HiddenPaymentItem" ADD CONSTRAINT "HiddenPaymentItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "HiddenPaymentItem" ADD CONSTRAINT "HiddenPaymentItem_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

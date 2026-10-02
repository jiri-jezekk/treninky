-- Dohodnutá splatnost položky.
--
-- Předplatné na podzim a na jaro: hráč má obě vidět, ale jaro je
-- domluvené až na leden. Do dne splatnosti se položka nepočítá do toho,
-- co má zaplatit teď, a nejde do výzev k platbě.
--
-- Psáno tak, aby šlo pustit znovu; viz README ve složce migrací.

CREATE TABLE IF NOT EXISTS "PaymentItemDue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "dueOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentItemDue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentItemDue_userId_idx" ON "PaymentItemDue"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentItemDue_playerId_key_key" ON "PaymentItemDue"("playerId", "key");

DO $$ BEGIN
    ALTER TABLE "PaymentItemDue" ADD CONSTRAINT "PaymentItemDue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "PaymentItemDue" ADD CONSTRAINT "PaymentItemDue_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

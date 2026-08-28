-- Rozvrh tréninků.
--
-- Úterý a čtvrtek byly napevno v kódu a generátor uměl jen jeden čas pro
-- oba dny — rozvrh „úterý 18:00–20:00, čtvrtek 19:30–21:00“ jím nešel
-- zadat vůbec. Termíny se proto stěhují do dat, kde si je trenér mění sám.

CREATE TABLE "TrainingSlot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingSlot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainingSlot_userId_dayOfWeek_startMinutes_key"
    ON "TrainingSlot"("userId", "dayOfWeek", "startMinutes");
CREATE INDEX "TrainingSlot_userId_dayOfWeek_idx" ON "TrainingSlot"("userId", "dayOfWeek");

ALTER TABLE "TrainingSlot" ADD CONSTRAINT "TrainingSlot_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Training" ADD COLUMN "endsAt" TIMESTAMP(3);
ALTER TABLE "Training" ADD COLUMN "slotId" TEXT;

ALTER TABLE "Training" ADD CONSTRAINT "Training_slotId_fkey"
    FOREIGN KEY ("slotId") REFERENCES "TrainingSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Výchozí rozvrh podle nových časů klubu. Ceny zůstávají takové, jaké
-- dosud vycházely ze dne v týdnu, aby se účtování nezměnilo:
-- úterý 110 Kč, čtvrtek 100 Kč. Trenér si je v aplikaci přepíše.
INSERT INTO "TrainingSlot" ("id", "userId", "dayOfWeek", "startMinutes", "endMinutes", "priceCents", "active", "createdAt")
SELECT gen_random_uuid()::text, u."id", 2, 18 * 60, 20 * 60, 11000, true, now()
FROM "User" u;

INSERT INTO "TrainingSlot" ("id", "userId", "dayOfWeek", "startMinutes", "endMinutes", "priceCents", "active", "createdAt")
SELECT gen_random_uuid()::text, u."id", 4, 19 * 60 + 30, 21 * 60, 10000, true, now()
FROM "User" u;

-- Každý uživatel má dostat oba termíny.
DO $$
DECLARE users INTEGER; slots INTEGER;
BEGIN
    SELECT count(*) INTO users FROM "User";
    SELECT count(*) INTO slots FROM "TrainingSlot";
    IF slots <> users * 2 THEN
        RAISE EXCEPTION 'Migrace zastavena: očekáváno % termínů rozvrhu, vzniklo %', users * 2, slots;
    END IF;
END $$;

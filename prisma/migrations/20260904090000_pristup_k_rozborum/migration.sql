-- Přístup hráče k rozborům.
--
-- Rozbory vidí celý klub, ale ne každý má být uvnitř: host na jeden
-- turnaj, hráč jiné kategorie. Zapnuté pro všechny, aby se nasazením
-- nikomu nic nezavřelo — vypíná se ručně u konkrétního hráče.
--
-- Psáno tak, aby šlo pustit znovu; viz README ve složce migrací.

ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "seesReviews" BOOLEAN NOT NULL DEFAULT true;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Player' AND column_name = 'seesReviews'
    ) THEN
        RAISE EXCEPTION 'Migrace zastavena: sloupec Player.seesReviews nevznikl';
    END IF;
END $$;

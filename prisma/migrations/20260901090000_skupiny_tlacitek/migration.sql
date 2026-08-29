-- Skupiny tlačítek počítadel (HIT, DEAD, …).
--
-- Proč: samotný počet „Hit counter fast“ nic neřekne. Teprve podíl na
-- všech hitech ukáže, co týmu vychází a co ne — a to jde spočítat jen
-- tehdy, když se tlačítka umí seskupit.
--
-- Sloupec je nepovinný a prázdný. Tlačítko bez skupiny stojí
-- v přehledu samo, takže se nic nemigruje a staré rozbory se chovají
-- přesně jako dosud.
--
-- Psáno tak, aby šlo pustit znovu; viz README ve složce migrací.

ALTER TABLE "ReviewEventType" ADD COLUMN IF NOT EXISTS "groupLabel" TEXT;

-- Pojistka: bez sloupce by se chyba projevila až trenérovi při
-- otevření rozborů.
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ReviewEventType'
          AND column_name = 'groupLabel'
    ) THEN
        RAISE EXCEPTION 'Migrace zastavena: sloupec ReviewEventType.groupLabel nevznikl';
    END IF;
END $$;

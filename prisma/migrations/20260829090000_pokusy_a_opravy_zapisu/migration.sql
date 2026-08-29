-- Víc pokusů tam, kde dřív směl být jen jeden zápis.
--
-- Měsíční výzva: jeden řádek byl konečný výsledek, takže druhý pokus
-- ten první přepsal a nebylo vidět, jak se kdo za měsíc posunul.
-- Nově je řádek jeden pokus, do pořadí se počítá nejlepší z nich
-- a historie zůstává.
--
-- Individuální trénink: unikát na (hráč, den) dovolil jeden zápis
-- denně. Kdo šel dopoledne házet a večer do fitka, měl smůlu —
-- druhý zápis první přepsal.
--
-- Psáno tak, aby šlo pustit znovu; viz README ve složce migrací.

DROP INDEX IF EXISTS "ChallengeEntry_challengeId_playerId_key";
CREATE INDEX IF NOT EXISTS "ChallengeEntry_challengeId_playerId_idx"
    ON "ChallengeEntry"("challengeId", "playerId");

DROP INDEX IF EXISTS "SoloSession_playerId_performedOn_key";
CREATE INDEX IF NOT EXISTS "SoloSession_playerId_performedOn_idx"
    ON "SoloSession"("playerId", "performedOn");

-- Pojistka: unikátní indexy opravdu zmizely. Kdyby některý zůstal,
-- druhý pokus by spadl na porušení jedinečnosti až hráči pod rukama.
DO $$
DECLARE zbylo INTEGER;
BEGIN
    SELECT count(*) INTO zbylo
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
          'ChallengeEntry_challengeId_playerId_key',
          'SoloSession_playerId_performedOn_key'
      );

    IF zbylo > 0 THEN
        RAISE EXCEPTION 'Migrace zastavena: zůstalo % unikátních indexů, víc pokusů by neprošlo', zbylo;
    END IF;
END $$;

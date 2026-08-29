-- Doplnění hodnot do výčtů, které v databázi už byly.
--
-- Migrace 20260828170000 zakládá výčty přes
--   DO $$ BEGIN CREATE TYPE … EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- To je odolné proti opakovanému spuštění, ale má díru: když typ toho
-- jména už existuje, přeskočí se **bez ohledu na to, jaké má hodnoty**.
-- A přesně to nastalo. Produkční „RatingSource“ pochází ze starší podoby
-- ratingu, která zápasy týmů neznala, takže hodnotu 'MATCH' nemá.
-- Vyhodnocení zápasu proto padalo na
--   22P02: invalid input value for enum "RatingSource": "MATCH"
--
-- Tahle migrace srovná všechny výčty se schématem. ADD VALUE IF NOT EXISTS
-- je bezpečné pustit znovu a existující hodnoty nechává být — pořadí
-- v enumu se nemění, takže se nic nepřečísluje.

ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'PRESENT';
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'ABSENT';

ALTER TYPE "TrainingKind" ADD VALUE IF NOT EXISTS 'TRAINING';
ALTER TYPE "TrainingKind" ADD VALUE IF NOT EXISTS 'GYM';

ALTER TYPE "IncomeKind" ADD VALUE IF NOT EXISTS 'MEMBERSHIP';
ALTER TYPE "IncomeKind" ADD VALUE IF NOT EXISTS 'TRAINING';
ALTER TYPE "IncomeKind" ADD VALUE IF NOT EXISTS 'EVENT';
ALTER TYPE "IncomeKind" ADD VALUE IF NOT EXISTS 'GOODS';
ALTER TYPE "IncomeKind" ADD VALUE IF NOT EXISTS 'OTHER';

ALTER TYPE "DuelStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "DuelStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "DuelStatus" ADD VALUE IF NOT EXISTS 'REPORTED';
ALTER TYPE "DuelStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE "DuelStatus" ADD VALUE IF NOT EXISTS 'DECLINED';

ALTER TYPE "RatingSource" ADD VALUE IF NOT EXISTS 'DUEL';
ALTER TYPE "RatingSource" ADD VALUE IF NOT EXISTS 'MATCH';
ALTER TYPE "RatingSource" ADD VALUE IF NOT EXISTS 'CHALLENGE';
ALTER TYPE "RatingSource" ADD VALUE IF NOT EXISTS 'COACH';

ALTER TYPE "DrillKind" ADD VALUE IF NOT EXISTS 'WARMUP';
ALTER TYPE "DrillKind" ADD VALUE IF NOT EXISTS 'DRILL';
ALTER TYPE "DrillKind" ADD VALUE IF NOT EXISTS 'GAME';
ALTER TYPE "DrillKind" ADD VALUE IF NOT EXISTS 'COOLDOWN';

-- Pojistka: každá hodnota ze schématu musí ve výčtu být. Bez ní by se
-- stejná chyba mohla vrátit u dalšího výčtu a projevila by se zase až
-- hráči pod rukama, uprostřed vyhodnocení.
DO $$
DECLARE
    ocekavane CONSTANT text[][] := ARRAY[
        ['AttendanceStatus', 'PRESENT'], ['AttendanceStatus', 'ABSENT'],
        ['TrainingKind', 'TRAINING'], ['TrainingKind', 'GYM'],
        ['IncomeKind', 'MEMBERSHIP'], ['IncomeKind', 'TRAINING'],
        ['IncomeKind', 'EVENT'], ['IncomeKind', 'GOODS'], ['IncomeKind', 'OTHER'],
        ['DuelStatus', 'PENDING'], ['DuelStatus', 'ACCEPTED'],
        ['DuelStatus', 'REPORTED'], ['DuelStatus', 'CONFIRMED'],
        ['DuelStatus', 'DECLINED'],
        ['RatingSource', 'DUEL'], ['RatingSource', 'MATCH'],
        ['RatingSource', 'CHALLENGE'], ['RatingSource', 'COACH'],
        ['DrillKind', 'WARMUP'], ['DrillKind', 'DRILL'],
        ['DrillKind', 'GAME'], ['DrillKind', 'COOLDOWN']
    ];
    i INTEGER;
    chybi text := '';
BEGIN
    FOR i IN 1 .. array_length(ocekavane, 1) LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_enum e ON e.enumtypid = t.oid
            WHERE t.typname = ocekavane[i][1]
              AND e.enumlabel = ocekavane[i][2]
        ) THEN
            chybi := chybi || ocekavane[i][1] || '.' || ocekavane[i][2] || ' ';
        END IF;
    END LOOP;

    IF chybi <> '' THEN
        RAISE EXCEPTION 'Migrace zastavena: ve výčtech chybí hodnoty: %', chybi;
    END IF;
END $$;

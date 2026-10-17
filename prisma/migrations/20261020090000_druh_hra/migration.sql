-- Druh cvičení „Hra“ — hra podle pravidel (utkání), vrchol hodiny.
--
-- Vkládá se před závěrečné uvolnění, protože pořadí hodnot výčtu
-- určuje řazení v knihovně (části tréninku jdou za sebou).
--
-- Psáno tak, aby šlo pustit znovu; viz README ve složce migrací.

ALTER TYPE "DrillKind" ADD VALUE IF NOT EXISTS 'GAME' BEFORE 'COOLDOWN';

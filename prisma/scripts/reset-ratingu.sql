-- Úklid testovacích dat ratingu.
--
-- Smaže všechno, co se do ratingu nasbíralo při zkoušení: duely,
-- zápasy, měsíční výzvy i s pokusy, individuální tréninky a historii
-- změn. Rating všech hráčů se vrátí na 1000.
--
-- ČEHO SE NEDOTKNE: hráči, kategorie, tréninky, docházka, platby,
-- předplatné, souhrnné platby ani akce. Ani jedna z těch tabulek se
-- tu nejmenuje.
--
-- Pustit jednou, v Neonu v SQL editoru. Celé je to v jedné transakci:
-- když cokoli neprojde, nezmění se nic.

BEGIN;

-- Pořadí je dané cizími klíči: nejdřív to, co na něčem visí.
DELETE FROM "RatingEntry";
DELETE FROM "ChallengeEntry";
DELETE FROM "Challenge";
DELETE FROM "Duel";
DELETE FROM "MatchTeamMember";
DELETE FROM "MatchTeam";
DELETE FROM "Match";
DELETE FROM "SoloSession";

-- Všichni od nuly.
UPDATE "PlayerRating" SET "points" = 1000;

-- Hráč přidaný později ještě řádek ratingu nemusí mít; ať ho má
-- každý, jinak by se v žebříčku objevil až po prvním duelu.
INSERT INTO "PlayerRating" ("id", "seasonId", "playerId", "points")
SELECT gen_random_uuid()::text, s."id", p."id", 1000
FROM "Player" p
JOIN "RatingSeason" s ON s."userId" = p."userId"
WHERE NOT EXISTS (
    SELECT 1 FROM "PlayerRating" r
    WHERE r."seasonId" = s."id" AND r."playerId" = p."id"
);

-- Pojistka: kdyby po úklidu něco zbylo nebo někomu zůstal jiný
-- rating, transakce spadne a nezmění se nic.
DO $$
DECLARE zbylo INTEGER; jine INTEGER; bez INTEGER;
BEGIN
    SELECT
        (SELECT count(*) FROM "RatingEntry")
      + (SELECT count(*) FROM "Duel")
      + (SELECT count(*) FROM "Match")
      + (SELECT count(*) FROM "Challenge")
      + (SELECT count(*) FROM "ChallengeEntry")
      + (SELECT count(*) FROM "SoloSession")
    INTO zbylo;
    IF zbylo > 0 THEN
        RAISE EXCEPTION 'Úklid zastaven: zůstalo % záznamů', zbylo;
    END IF;

    SELECT count(*) INTO jine FROM "PlayerRating" WHERE "points" <> 1000;
    IF jine > 0 THEN
        RAISE EXCEPTION 'Úklid zastaven: % hráčů nemá 1000', jine;
    END IF;

    SELECT count(*) INTO bez
    FROM "Player" p
    JOIN "RatingSeason" s ON s."userId" = p."userId"
    LEFT JOIN "PlayerRating" r ON r."seasonId" = s."id" AND r."playerId" = p."id"
    WHERE r."id" IS NULL;
    IF bez > 0 THEN
        RAISE EXCEPTION 'Úklid zastaven: % hráčům chybí rating', bez;
    END IF;
END $$;

COMMIT;

-- Kontrolní výpis: co zůstalo netknuté.
SELECT
    (SELECT count(*) FROM "Player") AS hraci,
    (SELECT count(*) FROM "Training") AS treninky,
    (SELECT count(*) FROM "Attendance") AS dochazka,
    (SELECT count(*) FROM "MonthlyPaymentMark") AS oznacene_platby,
    (SELECT count(*) FROM "Prepayment") AS predplatne,
    (SELECT count(*) FROM "SharedPayment") AS akce,
    (SELECT count(DISTINCT "points") FROM "PlayerRating") AS ruznych_ratingu;

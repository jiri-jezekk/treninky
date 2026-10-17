# Zadání: Plánovač tréninků

Stav: **hotové zadání, čeká na schválení** · větev `feat/planovac-treninku`

## Cíl

Trenér si v administraci připravuje tréninky pro 4 kategorie: **U12, U15, U18, A-tým**.
Tréninky skládá z vlastní knihovny cvičení a her, k bodům plánu má odhadovaný čas,
na hry si nechá vygenerovat vyrovnané týmy a po tréninku si zkopíruje krátké shrnutí
do deníku DDM.

Jen pro přihlášeného trenéra (sekce `(app)`). Hráčský portál `/p/[token]` se nemění.

**Ovládá se hlavně z telefonu:** tlačítka aspoň 40 px, formuláře přes celou šířku,
nativní výběr data a času, nic jen na najetí myší. Bod plánu se upraví klepnutím,
délka jde měnit o ±5 minut bez formuláře a vlastní bod jde při přidání rovnou
uložit i do knihovny.

**Mimo rozsah:** docházka. Děti se evidují v deníku DDM a dospělí v sekci Tréninky.
Plánovač nic neúčtuje ani nezapisuje účast.

## Výchozí stav v aplikaci

Už existuje a bude se na to stavět:

- `Drill` – knihovna cvičení (`/treninky/cviceni`): název, popis, výchozí minuty, druh
  (původně Rozcvička / Cvičení / Hra / Závěr), pomůcky, archivace.
- `TrainingBlock` – body plánu navázané na `Training` (rozvrh dospělých), časování
  (`withTimes`, `summarizePlan`), kopírování plánu, dělení do týmů (`splitIntoTeams`,
  náhodné podle kategorií).
- `Group` – kategorie hráčů (barva, pořadí).

Omezení: plán dnes visí na záznamu `Training`, který patří k rozvrhu, docházce
a platbám dospělých. Pro děti a juniory takový záznam není.

## 1. Plán tréninku (samostatný)

Nová entita **plán tréninku**, nezávislá na rozvrhu:

| Pole | Poznámka |
|---|---|
| datum a čas začátku | povinné |
| kategorie | jedna z U12 / U15 / U18 / A-tým – existující `Group`; chybějící se založí v Hráči → Kategorie |
| délka v minutách | z ní se počítá zbývající čas / přesah |
| téma / cíl | krátký text, např. „nahrávka po zemi“ – jde i do shrnutí |
| body plánu | viz níže |
| propojený trénink | volitelně `Training` z rozvrhu (jen u dospělých) |
| poznámka po tréninku | viz kap. 5 |

Body plánu: název, minuty, druh, **zaměření** (krátký text, např. „rychlost obratnost“),
poznámka, volitelně odkaz na cvičení z knihovny a uložené týmy. Řazení šipkami (případně tažením), časy se dopočítávají jako dnes.

- Nový plán jde založit prázdný, ze šablony (kap. 6) nebo kopií staršího plánu.
- **Bod napsaný přímo v plánu jde jedním klikem uložit do knihovny.**
- Přehled plánů: seznam podle data, filtr podle kategorie, nadcházející nahoře.

**Migrace:** stávající body plánu u tréninků (`TrainingBlock` → `Training`) se převedou
na plány propojené s daným tréninkem, aby se nic neztratilo. Plán u detailu tréninku
dál zůstane vidět.

## 2. Knihovna cvičení

**Druhy cvičení** (části tréninku, v tomto pořadí): Rozcvička · Pohybová hra ·
Herní cvičení · Průpravná hra · Průpravné cvičení · Závěrečné uvolnění.
Dřívější „Cvičení“ se převede na herní cvičení, „Hra“ na průpravnou hru.

K dnešním polím přibude:

- **kategorie**, pro které se cvičení hodí (více, prázdné = pro všechny),
- **zaměření** (krátký text, předvyplní se do bodu plánu a do shrnutí),
- **štítky** (volný text, našeptávání existujících: „úvodní hra“, „nahrávka“…),
- **minimální počet hráčů**,
- **odkaz** (video, obrázek, nákres),
- **naposledy použito** – dopočítané z plánů (kap. 6).

Hledání podle názvu a štítku, filtr podle druhu a kategorie. Při vkládání do plánu se
nabízí přednostně cvičení pro kategorii plánu.

## 3. Soupisky a hodnocení

Vlastní soupisky pro každou kategorii, **nezávislé na evidenci hráčů a plateb**.

- Účastník: jméno, kategorie, **dovednost 1–3** (1 = začátečník, 3 = nejlepší),
  aktivní ano/ne.
- Dospělé jde jednorázově naimportovat z Hráčů (jen jméno, bez vazby na platby).
- Rychlé zadávání: vložit víc jmen najednou (jedno na řádek), hodnocení klikem.

## 4. Generátor vyrovnaných týmů

Dostupný u herního bodu plánu i samostatně (rychlé rozdělení bez plánu).

1. Vybrat kategorii a zaškrtnout, kdo je dnes přítomen (výběr se pamatuje pro celý plán).
2. Zvolit počet týmů (2–4).
3. Generátor rozdělí hráče tak, aby:
   - se velikosti týmů lišily nejvýš o 1,
   - **součty dovedností** týmů byly co nejbližší,
   - při shodě vybral náhodně z rovnocenných řešení, ať „zamíchat znovu“ dává jiné týmy.
4. Zobrazí součet dovedností u každého týmu. Hráče jde ručně přehodit, výsledek se
   uloží k bodu plánu.

Výpočet jako čistá funkce v `src/lib` s testem v `scripts/` (jako `check:plan`).

## 5. Poznámka po tréninku a shrnutí do deníku

**Poznámka po tréninku:** volný text (co fungovalo / co ne) a u jednotlivých bodů
volitelně palec nahoru/dolů. Hodnocení se ukáže u cvičení v knihovně a při dalším
vkládání do plánu.

**Shrnutí do deníku:** tlačítko „Kopírovat shrnutí“ zkopíruje do schránky prostý text
do jednoho textového pole deníku DDM. Jeden bod plánu = jeden řádek
`název bodu` nebo `název bodu - zaměření`, bez data, časů a minut:

```
Pohybová hra - rychlost obratnost
Rozcvička a rozházení
Herní cvičení - protiútok
Hra
Závěrečné uvolnění
```

Text jde před kopírováním upravit (předvyplněné textové pole). Úprava se k plánu
neukládá – zdrojem jsou body plánu.

## 6. Šablony a „kdy naposledy“

- **Šablona:** pojmenovaná stavba hodiny pro kategorii (body s minutami, volitelně
  konkrétní cvičení). Plán jde uložit jako šablonu a ze šablony založit.
- **Kdy naposledy:** u cvičení v knihovně i v nabídce při vkládání je vidět datum
  posledního použití pro danou kategorii. Filtr „nepoužito přes 30 dní“.

## Technické poznámky

- Next.js 16 – před psaním kódu projít `node_modules/next/dist/docs/` (viz AGENTS.md).
- Dodržet pravidla responzivity z AGENTS.md (tabulky v `table-scroll-wrapper`,
  `min-w-0`, `max-w-*` u kontejnerů).
- Všechny dotazy omezené na `userId` přihlášeného trenéra.
## Umístění v aplikaci

**Samostatná položka menu „Plánovač“** (`/planovac`), hned pod „Tréninky“.
„Tréninky“ jsou rozvrh, docházka a platby dospělých, kdežto plánovač slouží všem
4 kategoriím a s platbami nesouvisí.

Podsekce (záložky): **Plány** · **Cvičení** · **Soupisky** · **Šablony** · **Týmy**
(rychlé rozdělení bez plánu).

- Knihovna cvičení se přesune z `/treninky/cviceni` do `/planovac/cviceni`,
  stará adresa přesměruje.
- U detailu tréninku dospělých zůstane odkaz na propojený plán (nebo „Založit plán“).

## Navržené pořadí práce

1. ✅ Datový model + migrace stávajících plánů, plány a knihovna v `/planovac`.
   (Migrace `20261017090000_planovac_treninku`; „kdy naposledy“ z kap. 2 patří do kroku 4.)
2. ✅ Shrnutí do deníku.
3. ✅ Soupisky a generátor vyrovnaných týmů (záložky Soupisky a Týmy, u plánu „Kdo dnes přišel“).
4. ✅ Šablony, „kdy naposledy“, poznámka po tréninku.

Každý krok jde nasadit samostatně.

## Možné rozšíření později

Režim na hřiště (mobil, odpočet času), dlouhodobý plán s cíli na pololetí, seznam
pomůcek k plánu, tisk / PDF.

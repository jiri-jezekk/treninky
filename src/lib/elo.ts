/**
 * Rating hráčů (Elo).
 *
 * Proč zrovna Elo: rozhoduje **rozdíl** ratingů, ne absolutní čísla.
 * Kdo porazí o třídu lepšího, získá hodně; kdo s ním prohraje, ztratí
 * skoro nic. Bez toho by se slabší hráči báli vyzvat silnější a celý
 * žebříček by ztuhl.
 *
 * Čistý výpočet bez databáze, aby se dal otestovat.
 */

/** Rating, se kterým hráč začíná. */
export const STARTING_RATING = 1000;

/**
 * Jak prudce se rating hýbe. 32 je běžná volba pro amatérské soutěže —
 * dost na to, aby se pořadí srovnalo za pár duelů, ale ne tolik, aby
 * jediná prohra shodila poctivě nasbíraný rating.
 */
export const K_DUEL = 32;

/**
 * Váha se zadává v procentech, aby šlo v aplikaci napsat „150 %“
 * místo abstraktního koeficientu. 100 % = běžný duel.
 */
export const WEIGHT_DUEL_DEFAULT = 100;
export const WEIGHT_MATCH_DEFAULT = 150;
export const WEIGHT_CHALLENGE_DEFAULT = 200;

/** Výsledek z pohledu jednoho hráče. */
export type Score = 0 | 0.5 | 1;

/**
 * Násobek podle toho, jak těsný výsledek byl.
 *
 * Vrací 1 při nejtěsnějším rozdílu a 2 při úplné jednostrannosti.
 * Počítá se **poměrem**, ne absolutním rozdílem — jinak by 20:0
 * v zápase znamenalo něco úplně jiného než 12,4 s proti 13,1 s
 * na člunkovém běhu, přestože obojí je jedna disciplína svého druhu.
 */
export function marginMultiplier(valueA: number, valueB: number): number {
  const a = Math.abs(valueA);
  const b = Math.abs(valueB);
  const total = a + b;
  if (total === 0) return 1;
  const dominance = Math.abs(a - b) / total;
  // Strop na dvojnásobku: ani nejjednostrannější výsledek nemá
  // udělat z jednoho duelu půlku sezóny.
  return 1 + Math.min(1, dominance);
}

/**
 * Očekávaná úspěšnost hráče A proti B — číslo mezi 0 a 1.
 * Při shodném ratingu 0,5; při náskoku 400 bodů zhruba 0,91.
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Změna ratingu po jednom duelu. Vrací dvojici, která dává dohromady
 * nulu — co jeden získá, druhý ztratí. Bez toho by rating v čase
 * nafukoval a přestal být porovnatelný.
 */
export function duelDeltas(
  ratingA: number,
  ratingB: number,
  scoreA: Score,
  options: {
    /** Váha disciplíny v procentech; 100 = běžný duel. */
    weightPercent?: number;
    /** Zapsané hodnoty — z nich se určí, jak těsný výsledek byl. */
    valueA?: number;
    valueB?: number;
    k?: number;
  } = {},
): { deltaA: number; deltaB: number } {
  const base = options.k ?? K_DUEL;
  const weight = (options.weightPercent ?? WEIGHT_DUEL_DEFAULT) / 100;
  const margin =
    options.valueA != null && options.valueB != null
      ? marginMultiplier(options.valueA, options.valueB)
      : 1;

  const expectedA = expectedScore(ratingA, ratingB);
  // U remízy nemá rozdíl skóre co násobit — hodnoty jsou stejné.
  const effective = scoreA === 0.5 ? base * weight : base * weight * margin;
  const deltaA = Math.round(effective * (scoreA - expectedA));
  // Druhý dostane přesný opak, ať součet sedí i po zaokrouhlení.
  return { deltaA, deltaB: -deltaA };
}

export type DuelOutcome = {
  score: Score;
  challengerDelta: number;
  opponentDelta: number;
  /** null u remízy. */
  challengerWins: boolean | null;
};

/**
 * Výsledek duelu na jednom místě.
 *
 * Používá to potvrzení i náhled „co se stane, když potvrdíš“. Kdyby
 * každé počítalo po svém, mohl by hráč vidět jedno číslo a dostat jiné.
 */
export function duelOutcome(params: {
  ratingChallenger: number;
  ratingOpponent: number;
  challengerValue: number;
  opponentValue: number;
  higherWins: boolean;
  weightPercent: number;
}): DuelOutcome {
  const score = scoreFromValues(
    params.challengerValue,
    params.opponentValue,
    params.higherWins,
  );
  const { deltaA, deltaB } = duelDeltas(
    params.ratingChallenger,
    params.ratingOpponent,
    score,
    {
      weightPercent: params.weightPercent,
      valueA: params.challengerValue,
      valueB: params.opponentValue,
    },
  );
  return {
    score,
    challengerDelta: deltaA,
    opponentDelta: deltaB,
    challengerWins: score === 0.5 ? null : score === 1,
  };
}

/** Kdo vyhrál podle zapsaných hodnot. */
export function scoreFromValues(
  valueA: number,
  valueB: number,
  higherWins: boolean,
): Score {
  if (valueA === valueB) return 0.5;
  const aBetter = higherWins ? valueA > valueB : valueA < valueB;
  return aBetter ? 1 : 0;
}

export type ChallengeResult = {
  playerId: string;
  rating: number;
  value: number;
};

export type ChallengeDelta = {
  playerId: string;
  /** Pořadí od 1; při shodné hodnotě sdílené. */
  rank: number;
  delta: number;
};

/**
 * Rating po měsíční výzvě.
 *
 * Pořadí se rozloží na dvojice: každý „hraje“ proti každému a vyhrává
 * ten s lepším umístěním. Součet se vydělí počtem soupeřů, aby výsledek
 * nezávisel na tom, kolik lidí se přihlásilo — o velikosti pohybu má
 * rozhodovat váha výzvy, ne účast.
 *
 * Výchozí váha je 150 %, takže výzva váží víc než běžný duel.
 *
 * Díky tomu platí to, oč jde: skončit pátý mezi samými silnějšími
 * rating zvedne, kdežto stejné umístění mezi slabšími ho srazí.
 */
export function challengeDeltas(
  results: ChallengeResult[],
  higherWins: boolean,
  options: { weightPercent?: number; k?: number } = {},
): ChallengeDelta[] {
  const k =
    (options.k ?? K_DUEL) * ((options.weightPercent ?? WEIGHT_CHALLENGE_DEFAULT) / 100);
  if (results.length < 2) {
    return results.map((r) => ({ playerId: r.playerId, rank: 1, delta: 0 }));
  }

  const sorted = [...results].sort((a, b) =>
    higherWins ? b.value - a.value : a.value - b.value,
  );

  // Shodná hodnota = shodné pořadí (1, 2, 2, 4).
  const rankOf = new Map<string, number>();
  sorted.forEach((r, i) => {
    const prev = sorted[i - 1];
    if (prev && prev.value === r.value) {
      rankOf.set(r.playerId, rankOf.get(prev.playerId)!);
    } else {
      rankOf.set(r.playerId, i + 1);
    }
  });

  const opponents = results.length - 1;

  return results.map((me) => {
    let actual = 0;
    let expected = 0;

    for (const other of results) {
      if (other.playerId === me.playerId) continue;
      const myRank = rankOf.get(me.playerId)!;
      const theirRank = rankOf.get(other.playerId)!;
      actual += myRank === theirRank ? 0.5 : myRank < theirRank ? 1 : 0;
      expected += expectedScore(me.rating, other.rating);
    }

    return {
      playerId: me.playerId,
      rank: rankOf.get(me.playerId)!,
      delta: Math.round((k * (actual - expected)) / opponents),
    };
  });
}

/** Slovní zařazení podle ratingu — pro hráče čitelnější než holé číslo. */
export function ratingBand(rating: number): string {
  if (rating >= 1300) return "Špička";
  if (rating >= 1150) return "Pokročilý";
  if (rating >= 1050) return "Zkušený";
  if (rating >= 950) return "Základ";
  return "Začátečník";
}

export type TeamResult = {
  teamId: string;
  /** Průměrný rating členů — tým vystupuje jako jeden „hráč“. */
  rating: number;
  score: number;
};

export type TeamDelta = {
  teamId: string;
  rank: number;
  /** Změna, kterou dostane každý člen týmu. */
  delta: number;
};

/**
 * Rating po zápase týmů.
 *
 * Tým se počítá jako jeden hráč s průměrným ratingem svých členů a
 * změna pak platí pro každého z nich. Slabší hráč v silném týmu tak
 * získá míň, než kdyby vyhrál sám — a naopak.
 *
 * Dva týmy se počítají jako duel, takže se uplatní i rozdíl skóre
 * (20:0 hne ratingem víc než 11:9). U tří a víc týmů rozhoduje pořadí,
 * stejně jako u měsíční výzvy.
 */
export function teamDeltas(
  teams: TeamResult[],
  weightPercent: number = WEIGHT_MATCH_DEFAULT,
): TeamDelta[] {
  if (teams.length < 2) {
    return teams.map((t) => ({ teamId: t.teamId, rank: 1, delta: 0 }));
  }

  if (teams.length === 2) {
    const [a, b] = teams as [TeamResult, TeamResult];
    const score: Score = a.score === b.score ? 0.5 : a.score > b.score ? 1 : 0;
    const { deltaA, deltaB } = duelDeltas(a.rating, b.rating, score, {
      weightPercent,
      valueA: a.score,
      valueB: b.score,
    });
    const aWins = a.score > b.score;
    const bWins = b.score > a.score;
    return [
      { teamId: a.teamId, rank: aWins ? 1 : bWins ? 2 : 1, delta: deltaA },
      { teamId: b.teamId, rank: bWins ? 1 : aWins ? 2 : 1, delta: deltaB },
    ];
  }

  const asChallenge = challengeDeltas(
    teams.map((t) => ({ playerId: t.teamId, rating: t.rating, value: t.score })),
    true,
    { weightPercent },
  );
  return asChallenge.map((d) => ({
    teamId: d.playerId,
    rank: d.rank,
    delta: d.delta,
  }));
}

/** Průměrný rating týmu. Prázdný tým se počítá jako začátečnický. */
export function averageRating(ratings: number[]): number {
  if (ratings.length === 0) return STARTING_RATING;
  return Math.round(ratings.reduce((s, r) => s + r, 0) / ratings.length);
}

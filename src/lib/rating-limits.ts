/**
 * Stropy na to, co si hráč může sám zapsat.
 *
 * Jsou tady, a ne v souborech s „use server“ — tam smí být exportované
 * jen asynchronní funkce.
 */

/**
 * Kolik individuálních tréninků se dá zapsat na jeden den.
 *
 * Dřív to byl jeden a druhý zápis ten první přepsal — kdo šel dopoledne
 * házet a večer do fitka, o bod přišel. Teď se počítají oba. Strop tu
 * ale zůstává: zápis nikdo nekontroluje, takže bez něj by šlo šplhat
 * žebříčkem klikáním z gauče. Čtyři poctivé tréninky za den nikdo
 * neudělá, takže reálnému používání to nepřekáží.
 */
export const MAX_SOLO_PER_DAY = 4;

/**
 * Kolik pokusů smí mít hráč v jedné měsíční výzvě.
 *
 * Do pořadí se počítá jen nejlepší, takže na rating strop vliv nemá —
 * je jen proto, aby se historie výzvy nezaplnila stovkou řádků.
 */
export const MAX_ATTEMPTS_PER_CHALLENGE = 30;

/**
 * Kolik ratingu přidá jedna účast — klubový trénink, posilovna
 * i individuální trénink.
 *
 * Jediné místo, kde se to nastavuje: docházková část se nikam
 * neukládá, dopočítává se, takže změna téhle konstanty se hned
 * projeví všude i zpětně.
 *
 * Pět bodů je vědomá volba trenéra: pravidelná docházka má na
 * žebříček viditelný vliv, ne jen symbolický. Deset tréninků tak
 * vydá zhruba za dva vyhrané duely.
 */
export const RATING_PER_ATTENDANCE = 5;

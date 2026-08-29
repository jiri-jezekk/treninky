import type { ReviewSideValue } from "./review-stats.ts";

/**
 * Barvy tlačítek počítadel.
 *
 * Vybírá se ze seznamu, nepíše se ručně — jinak by si každý zvolil
 * svůj odstín a přehled by přestal být čitelný. Odstíny odpovídají
 * paletě v globals.css: klubová modrá, zelená pro naše, červená pro
 * soupeřovy, oranžová a šedá na to ostatní. Všechny drží čitelnost
 * na světlém i tmavém pozadí, protože se používají jako výplň
 * s bílým textem.
 */
export const REVIEW_COLORS: string[] = [
  "#0ea5e9", // klubová modrá
  "#059669", // zelená
  "#dc2626", // červená
  "#f97316", // klubová oranžová
  "#7c3aed", // fialová
  "#64748b", // šedá
];

/**
 * Tlačítka, se kterými klub začíná.
 *
 * Zakládají se při prvním otevření rozborů. Bez tlačítek by byla
 * stránka k ničemu a nutit trenéra, aby si je nejdřív vymyslel, je
 * zbytečná překážka — přejmenovat i smazat je může kdykoli.
 *
 * FOR = počítá se nám, AGAINST = soupeři, NEUTRAL = mimo bilanci.
 * „Chyba / ztráta“ je schválně neutrální: je to poznámka k práci
 * s míčem, ne bod pro soupeře.
 */
export const DEFAULT_EVENT_TYPES: {
  label: string;
  color: string;
  side: ReviewSideValue;
}[] = [
  { label: "Náš hit", color: "#0ea5e9", side: "FOR" },
  { label: "Dostali jsme hit", color: "#dc2626", side: "AGAINST" },
  { label: "Chycení", color: "#059669", side: "FOR" },
  { label: "Chycení soupeře", color: "#f97316", side: "AGAINST" },
  { label: "Dobrý úhyb", color: "#7c3aed", side: "NEUTRAL" },
  { label: "Chyba / ztráta", color: "#64748b", side: "NEUTRAL" },
];

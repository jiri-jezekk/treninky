import { randomBytes } from "node:crypto";

/**
 * Token do veřejné adresy /p/<token>. Devět náhodných bajtů = 18 hex znaků,
 * tedy 72 bitů — na hádání hrubou silou dost i bez omezení počtu pokusů.
 */
export function newPayToken(): string {
  return randomBytes(9).toString("hex");
}

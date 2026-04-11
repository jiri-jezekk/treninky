/** Na produkci nastav ALLOW_REGISTRATION=false (Vercel), aby šlo registrovat jen lokálně / před zámkem. */
export function isRegistrationOpen() {
  return process.env.ALLOW_REGISTRATION !== "false";
}

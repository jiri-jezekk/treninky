export function resolveTrainingPriceCents(opts: {
  trainingDefault: number | null;
  userDefault: number | null;
  billing: { priceCents: number | null; prepaid: boolean } | null;
}): number {
  if (opts.billing?.prepaid) return 0;
  if (opts.billing?.priceCents != null) return opts.billing.priceCents;
  if (opts.trainingDefault != null) return opts.trainingDefault;
  if (opts.userDefault != null) return opts.userDefault;
  return 0;
}

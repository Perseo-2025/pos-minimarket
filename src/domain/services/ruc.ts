// Peruvian RUC (taxpayer id): 11 digits, a known prefix and a mod-11 check
// digit (SUNAT's algorithm). Catches typos before a supplier is saved.
// Prefixes: 10 persona natural, 15/16/17 special cases, 20 empresa.
const RUC_PATTERN = /^(10|15|16|17|20)\d{9}$/;
const WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export function isValidRuc(ruc: string): boolean {
  if (!RUC_PATTERN.test(ruc)) return false;
  const sum = WEIGHTS.reduce((total, weight, i) => total + weight * Number(ruc[i]), 0);
  const check = (11 - (sum % 11)) % 10;
  return check === Number(ruc[10]);
}

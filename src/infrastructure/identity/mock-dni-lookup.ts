import { DniNotFoundError, IdentityServiceUnavailableError } from "@/domain/errors";
import type { IdentityLookup } from "@/domain/repositories/identity-lookup";

const FIRST_NAMES = ["JUAN", "MARÍA", "CARLOS", "ROSA", "LUIS", "ANA", "JORGE", "LUCÍA"];
const LAST_NAMES = ["PÉREZ", "QUISPE", "FLORES", "RAMOS", "TORRES", "CHÁVEZ", "ROJAS", "VEGA"];

// Development stand-in for the RENIEC provider. Deterministic per DNI, plus
// two special DNIs to exercise the failure paths from the UI:
// - 00000000 → DNI not found
// - 99999999 → service unavailable
export class MockDniLookup implements IdentityLookup {
  async lookupDni(dni: string) {
    await new Promise((resolve) => setTimeout(resolve, 400));

    if (dni === "00000000") throw new DniNotFoundError();
    if (dni === "99999999") throw new IdentityServiceUnavailableError();

    const digits = dni.split("").map(Number);
    const pick = (list: string[], i: number) => list[(digits[i] + digits[i + 1]) % list.length];

    return {
      dni,
      fullName: `${pick(FIRST_NAMES, 0)} ${pick(LAST_NAMES, 2)} ${pick(LAST_NAMES, 4)}`,
    };
  }
}

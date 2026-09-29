import { IdentityServiceUnavailableError } from "@/domain/errors";
import type { IdentityLookup } from "@/domain/repositories/identity-lookup";
import { MockDniLookup } from "./mock-dni-lookup";
import { SunatDniLookup } from "./sunat-dni-lookup";

// Never let a slow provider hold the till: past this, the cashier is asked to
// type the name instead.
export const DNI_LOOKUP_TIMEOUT_MS = 5_000;

// Provider selected with DNI_PROVIDER:
// - "sunat" (default): SUNAT's public DNI lookup.
// - "mock": fake names, for development/tests without internet.
// - "none": no lookup, the cashier always types the name.
class DisabledDniLookup implements IdentityLookup {
  async lookupDni(): Promise<never> {
    throw new IdentityServiceUnavailableError("Consulta DNI desactivada");
  }
}

function createIdentityLookup(): IdentityLookup {
  switch (process.env.DNI_PROVIDER ?? "sunat") {
    case "mock":
      return new MockDniLookup();
    case "none":
      return new DisabledDniLookup();
    default:
      return new SunatDniLookup(DNI_LOOKUP_TIMEOUT_MS);
  }
}

export const identityLookup = createIdentityLookup();

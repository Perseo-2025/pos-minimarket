// Port for looking up a Peruvian DNI (RENIEC data through a third-party
// provider). The provider is swappable; the domain only needs the full name.
// Implementations throw DniNotFoundError / IdentityServiceUnavailableError.
export interface IdentityLookup {
  lookupDni(dni: string): Promise<{ dni: string; fullName: string }>;
}

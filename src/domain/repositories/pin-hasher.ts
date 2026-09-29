// Port for hashing/verifying worker PINs. The implementation must be usable
// in the browser too (offline verification), see infrastructure/security.
export interface PinHasher {
  hash(pin: string): Promise<string>;
  verify(pin: string, stored: string): Promise<boolean>;
  // PINs registered offline arrive pre-hashed; reject weak/malformed hashes.
  isValidHash(stored: string): boolean;
}

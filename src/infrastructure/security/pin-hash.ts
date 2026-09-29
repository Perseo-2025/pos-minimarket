// PBKDF2-SHA256 over WebCrypto, which exists both in the browser and in
// Node — the POS verifies PINs offline with exactly the same code the server
// uses. Format: "pbkdf2-sha256$<iterations>$<salt b64>$<hash b64>".
//
// A 6-digit PIN has only 1,000,000 combinations, so the iteration count is
// what makes brute-forcing a leaked hash slow; lockouts and audit events
// cover the till itself.
const PREFIX = "pbkdf2-sha256";
const ITERATIONS = 150_000;
const MIN_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

const HASH_PATTERN = /^pbkdf2-sha256\$(\d+)\$([A-Za-z0-9+/=]+)\$([A-Za-z0-9+/=]+)$/;

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derive(pin: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(pin, salt, ITERATIONS);
  return `${PREFIX}$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

// Registrations queued offline arrive already hashed; the server only
// accepts hashes in this exact format and with enough iterations.
export function isValidPinHash(stored: string) {
  const match = HASH_PATTERN.exec(stored);
  if (!match) return false;
  const iterations = Number(match[1]);
  return (
    iterations >= MIN_ITERATIONS &&
    iterations <= 2_000_000 &&
    fromBase64(match[2]).length === SALT_BYTES &&
    fromBase64(match[3]).length === HASH_BYTES
  );
}

export async function verifyPin(pin: string, stored: string) {
  const match = HASH_PATTERN.exec(stored);
  if (!match) return false;

  const expected = fromBase64(match[3]);
  const actual = await derive(pin, fromBase64(match[2]), Number(match[1]));
  if (actual.length !== expected.length) return false;

  // Constant-time comparison.
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export const pinHasher = {
  hash: hashPin,
  verify: verifyPin,
  isValidHash: isValidPinHash,
};

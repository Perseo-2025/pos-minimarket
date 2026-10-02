import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

// Signed proof that an admin approved giving products away (courtesy) at a
// cashier's till. It is bound to one sale, one cashier and the exact amount
// given away, so it can't be reused on another sale or stretched to cover
// more products than the admin saw.
const TOKEN_TTL_MS = 15 * 60 * 1000;

type TokenPayload = {
  s: string; // sale uuid (the sale has no numeric id until it syncs)
  c: number; // cashier id
  a: number; // approving admin id
  amt: string; // courtesy amount, fixed to cents
  exp: number;
  n: string;
};

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return value;
}

function sign(data: string) {
  // Domain-separated from worker tokens: one can't be passed off as the other.
  return createHmac("sha256", secret())
    .update(`courtesy-token:${data}`)
    .digest("base64url");
}

export function issueCourtesyToken(input: {
  saleUuid: string;
  cashierId: number;
  adminId: number;
  amount: number;
}) {
  const payload: TokenPayload = {
    s: input.saleUuid,
    c: input.cashierId,
    a: input.adminId,
    amt: input.amount.toFixed(2),
    exp: Date.now() + TOKEN_TTL_MS,
    n: randomUUID(),
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

// Returns the approving admin's id, or null when the token is missing,
// forged, expired, or doesn't match this sale/cashier/amount.
export function verifyCourtesyToken(
  token: string | undefined,
  expected: { saleUuid: string; cashierId: number; amount: number; at: Date },
): number | null {
  if (!token) return null;

  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expectedSignature = Buffer.from(sign(data));
  const actualSignature = Buffer.from(signature);
  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8"),
    ) as TokenPayload;
    const matches =
      payload.s === expected.saleUuid &&
      payload.c === expected.cashierId &&
      payload.amt === expected.amount.toFixed(2) &&
      expected.at.getTime() <= payload.exp;
    return matches ? payload.a : null;
  } catch {
    return null;
  }
}

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

// Signed proof that a worker's PIN was verified online by the server. The
// POS attaches it to the sale; at sync time the server checks the signature,
// so a sale cannot claim "pin_online" without the server having seen the
// right PIN for that worker, at that cashier's till.
const TOKEN_TTL_MS = 15 * 60 * 1000;

type TokenPayload = { w: string; c: string; exp: number; n: string };

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return value;
}

function sign(data: string) {
  return createHmac("sha256", secret())
    .update(`worker-token:${data}`)
    .digest("base64url");
}

export function issueWorkerToken(workerId: string, cashierId: string) {
  const payload: TokenPayload = {
    w: workerId,
    c: cashierId,
    exp: Date.now() + TOKEN_TTL_MS,
    n: randomUUID(),
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

// `at` is when the sale was made: a sale queued right after verification but
// synced later is still valid, as long as it was charged within the TTL.
export function verifyWorkerToken(
  token: string | undefined,
  expected: { workerId: string; cashierId: string; at: Date },
) {
  if (!token) return false;

  const [data, signature] = token.split(".");
  if (!data || !signature) return false;

  const expectedSignature = Buffer.from(sign(data));
  const actualSignature = Buffer.from(signature);
  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8"),
    ) as TokenPayload;
    return (
      payload.w === expected.workerId &&
      payload.c === expected.cashierId &&
      expected.at.getTime() <= payload.exp
    );
  } catch {
    return false;
  }
}

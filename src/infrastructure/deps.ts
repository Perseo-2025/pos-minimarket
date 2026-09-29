import { DNI_LOOKUP_TIMEOUT_MS, identityLookup } from "./identity";
import {
  auditRepository,
  discountPolicyRepository,
  productRepository,
  saleRepository,
  userRepository,
  workerRepository,
} from "./repositories";
import { pinHasher } from "./security/pin-hash";
import { issueCourtesyToken, verifyCourtesyToken } from "./security/courtesy-token";
import { issueWorkerToken, verifyWorkerToken } from "./security/worker-token";

// Composition root for the use cases that need several adapters.
export const saleDeps = {
  sales: saleRepository,
  users: userRepository,
  products: productRepository,
  workers: workerRepository,
  policies: discountPolicyRepository,
  verifyWorkerToken,
  verifyCourtesyToken,
};

export const courtesyDeps = {
  users: userRepository,
  audit: auditRepository,
  issueCourtesyToken,
};

export const workerDeps = {
  workers: workerRepository,
  audit: auditRepository,
  identity: identityLookup,
  pinHasher,
  policies: discountPolicyRepository,
  issueToken: issueWorkerToken,
};

export { DNI_LOOKUP_TIMEOUT_MS };

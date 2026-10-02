import { BLOCKING_AUDIT_FLAGS, type AuditFlag } from "@/domain/entities/audit";
import { can } from "@/domain/entities/user";
import type { SaleRecord } from "@/domain/entities/sale";
import {
  CashierNotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from "@/domain/errors";
import type { DiscountPolicyRepository } from "@/domain/repositories/discount-policy-repository";
import type { ProductRepository } from "@/domain/repositories/product-repository";
import type { SaleRepository } from "@/domain/repositories/sale-repository";
import type { UserRepository } from "@/domain/repositories/user-repository";
import type { WorkerRepository } from "@/domain/repositories/worker-repository";
import { evaluateSaleFlags } from "@/domain/services/sale-audit";
import { lineTotal } from "@/domain/services/sale-pricing";
import { round2 } from "@/domain/value-objects/money";
import { storeDayStart, storeYearStart } from "@/domain/value-objects/store-time";
import { saleCreateSchema } from "@/application/validation/sale";

export interface CreateSaleDeps {
  sales: SaleRepository;
  users: UserRepository;
  products: ProductRepository;
  workers: WorkerRepository;
  policies: DiscountPolicyRepository;
}

export async function createSaleUseCase(
  repos: CreateSaleDeps,
  input: unknown,
  actorId: number,
) {
  const data = saleCreateSchema.parse(input);

  // The JWT only proves who logged in at some point — the user may have been
  // deactivated or removed since. Re-check against the DB, and take the role
  // from there too, before accepting money into anyone's register.
  const actor = await repos.users.findById(actorId);
  if (!actor || !actor.isActive) {
    throw new UnauthorizedError("Session user is no longer valid");
  }

  const cashierId = data.cashierId ?? actor.id;

  if (cashierId !== actor.id) {
    // Only an admin may sync a sale on behalf of another cashier; a cashier
    // syncing someone else's sale would corrupt both registers.
    if (!can(actor.role, "manage")) {
      throw new ForbiddenError("Sale belongs to another cashier");
    }

    const cashier = await repos.users.findById(cashierId);
    if (!cashier) throw new CashierNotFoundError(cashierId);
  }

  // Retry of an already-synced sale: nothing to re-evaluate.
  if (await repos.sales.existsByUuid(data.uuid)) {
    return { uuid: data.uuid, total: data.total, inserted: false };
  }

  // Never trust client-computed amounts: line totals are recomputed, each
  // line's discount is clamped to its gross amount (a gift line takes none:
  // it is given away whole), and everything is compared against the catalog
  // below.
  const items = allocateLegacyDiscount(
    data.items.map(({ isCourtesy, ...item }) => {
      const gross = lineTotal(item);
      const isGift = item.isGift ?? isCourtesy ?? false;
      const discountAmount = isGift
        ? 0
        : round2(Math.min(Math.max(0, item.discountAmount), gross));
      return {
        ...item,
        lineTotal: gross,
        isGift,
        discountAmount,
        discountUnitAmount:
          discountAmount === 0
            ? 0
            : round2(item.discountUnitAmount || discountAmount / item.quantity),
      };
    }),
    data.discountTotal,
  );
  const subtotal = round2(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const chargedDiscount = round2(
    items.reduce((sum, item) => sum + item.discountAmount, 0),
  );
  const giftTotal = round2(
    items.reduce((sum, item) => sum + (item.isGift ? item.lineTotal : 0), 0),
  );
  const total = round2(subtotal - chargedDiscount - giftTotal);

  const catalog = await repos.products.findCatalogByIds([
    ...new Set(items.map((item) => item.productId)),
  ]);

  const soldAt = new Date(data.clientCreatedAt);
  const worker = data.workerId ? await repos.workers.findById(data.workerId) : null;
  const policy = worker
    ? ((data.policyId ? await repos.policies.findById(data.policyId) : null) ??
      (await repos.policies.getActive()))
    : null;
  const usage = worker
    ? await repos.workers.discountUsage(
        worker.id,
        storeDayStart(soldAt),
        storeYearStart(soldAt),
      )
    : null;

  const flags: AuditFlag[] = evaluateSaleFlags({
    lines: items,
    catalog,
    chargedDiscount,
    giftTotal,
    soldAt,
    worker,
    policy,
    usage,
  });
  // The POS referenced a worker the server doesn't know.
  if (data.workerId && !worker) flags.push("INVALID_VERIFICATION");

  const earnsPoints =
    worker !== null &&
    policy !== null &&
    !flags.some((flag) => BLOCKING_AUDIT_FLAGS.includes(flag));

  const record: SaleRecord = {
    uuid: data.uuid,
    shiftUuid: data.shiftUuid ?? null,
    cashierId,
    paymentType: data.paymentType,
    items,
    clientCreatedAt: data.clientCreatedAt,
    subtotal,
    discountTotal: chargedDiscount,
    giftTotal,
    total,
    workerId: worker?.id ?? null,
    policyId: policy?.id ?? null,
    workerVerification: worker ? data.workerVerification : "none",
    pointsEarned: earnsPoints ? Math.floor(total * policy.pointsPerSol) : 0,
    auditFlags: flags,
  };

  return repos.sales.insertWithItems(record);
}

// Sales queued before per-product discounts only carry a sale-level
// discountTotal. Spread it over the lines (in order, never above a line's
// amount) so the per-line audit and history still make sense.
function allocateLegacyDiscount<
  T extends { lineTotal: number; discountAmount: number; isGift: boolean },
>(items: T[], legacyTotal: number): T[] {
  const hasLineDiscounts = items.some((item) => item.discountAmount > 0);
  if (hasLineDiscounts || legacyTotal <= 0) return items;

  let remaining = round2(legacyTotal);
  return items.map((item) => {
    if (item.isGift || remaining <= 0) return item;
    const amount = round2(Math.min(item.lineTotal, remaining));
    remaining = round2(remaining - amount);
    return { ...item, discountAmount: amount };
  });
}

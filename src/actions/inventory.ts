"use server";

import { revalidatePath } from "next/cache";
import { countStockUseCase } from "@/application/use-cases/inventory/count-stock";
import {
  reviewCountUseCase,
  submitDailyCountUseCase,
} from "@/application/use-cases/inventory/daily-count";
import { resolveDiscrepancyUseCase } from "@/application/use-cases/inventory/discrepancies";
import { receiveGoodsUseCase } from "@/application/use-cases/inventory/receive-goods";
import { transferStockUseCase } from "@/application/use-cases/inventory/transfer-stock";
import { requirePermission } from "@/infrastructure/auth/guards";
import {
  dailyCountRepository,
  inventoryRepository,
  presentationRepository,
  productRepository,
  purchaseOrderRepository,
  receivingRepository,
} from "@/infrastructure/repositories";
import { runAction, runDataAction } from "./action-result";

// Counting/adjusting is the admin's; receiving and transfers are open to
// the warehouse keeper too (the admin has every permission).
async function requireAdmin() {
  return (await requirePermission("manage")).id;
}

async function requireStock() {
  return (await requirePermission("stock")).id;
}

export async function countStock(input: unknown) {
  return runDataAction(async () => {
    const actorId = await requireAdmin();
    const result = await countStockUseCase(
      { inventory: inventoryRepository, products: productRepository },
      input,
      actorId,
    );

    revalidatePath("/admin", "layout");
    revalidatePath("/pos");
    return result;
  });
}

// Stock moved: inventory, products (stock and average cost), the till's
// catalog and the dashboard steps all change.
function revalidateStockViews() {
  revalidatePath("/admin", "layout");
  revalidatePath("/almacen", "layout");
  revalidatePath("/pos");
}

export async function receiveGoods(input: unknown) {
  return runDataAction(async () => {
    const actorId = await requireStock();
    const result = await receiveGoodsUseCase(
      {
        receiving: receivingRepository,
        products: productRepository,
        presentations: presentationRepository,
        orders: purchaseOrderRepository,
      },
      input,
      actorId,
    );
    revalidateStockViews();
    return result;
  });
}

export async function transferStock(input: unknown) {
  return runDataAction(async () => {
    const actorId = await requireStock();
    const result = await transferStockUseCase(
      {
        receiving: receivingRepository,
        inventory: inventoryRepository,
        presentations: presentationRepository,
      },
      input,
      actorId,
    );
    revalidateStockViews();
    return result;
  });
}

export async function resolveDiscrepancy(input: unknown) {
  return runAction(async () => {
    const actorId = await requireAdmin();
    await resolveDiscrepancyUseCase(receivingRepository, input, actorId);
    revalidateStockViews();
  });
}

export async function submitDailyCount(input: unknown) {
  return runDataAction(async () => {
    const actorId = await requireStock();
    const result = await submitDailyCountUseCase(
      {
        counts: dailyCountRepository,
        products: productRepository,
        inventory: inventoryRepository,
      },
      input,
      actorId,
    );
    revalidateStockViews();
    return result;
  });
}

export async function reviewCount(input: unknown) {
  return runAction(async () => {
    const actorId = await requireAdmin();
    await reviewCountUseCase(dailyCountRepository, input, actorId);
    revalidateStockViews();
  });
}

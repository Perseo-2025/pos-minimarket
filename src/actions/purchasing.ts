"use server";

import { revalidatePath } from "next/cache";
import {
  cancelPurchaseOrderUseCase,
  createPurchaseOrderUseCase,
} from "@/application/use-cases/purchasing/purchase-orders";
import { idSchema } from "@/application/validation/id";
import { requirePermission } from "@/infrastructure/auth/guards";
import {
  presentationRepository,
  productRepository,
  purchaseOrderRepository,
  supplierRepository,
} from "@/infrastructure/repositories";
import { runAction, runDataAction } from "./action-result";

function revalidateOrderViews() {
  revalidatePath("/admin/compras", "layout");
  revalidatePath("/admin/inventory", "layout");
  revalidatePath("/almacen", "layout");
}

export async function createPurchaseOrder(input: unknown) {
  return runDataAction(async () => {
    const admin = await requirePermission("manage");
    const result = await createPurchaseOrderUseCase(
      {
        orders: purchaseOrderRepository,
        suppliers: supplierRepository,
        products: productRepository,
        presentations: presentationRepository,
      },
      input,
      admin.id,
    );
    revalidateOrderViews();
    return result;
  });
}

export async function cancelPurchaseOrder(id: number) {
  return runAction(async () => {
    await requirePermission("manage");
    await cancelPurchaseOrderUseCase(purchaseOrderRepository, idSchema.parse(id));
    revalidateOrderViews();
  });
}

import { redirect } from "next/navigation";
import { getExpiringLotsUseCase } from "@/application/use-cases/inventory/get-inventory";
import { listSellableProductsUseCase } from "@/application/use-cases/products/list-products";
import { listPresentationsUseCase } from "@/application/use-cases/products/save-presentation";
import { PosScreen } from "@/components/pos/pos-screen";
import { auth } from "@/infrastructure/auth";
import {
  inventoryRepository,
  presentationRepository,
  productRepository,
} from "@/infrastructure/repositories";

export default async function PosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [products, expiring, presentations] = await Promise.all([
    listSellableProductsUseCase(productRepository),
    getExpiringLotsUseCase(inventoryRepository),
    listPresentationsUseCase(presentationRepository),
  ]);
  // What the cashier can act on: lots on the shop floor.
  const shelfExpiry = expiring.lots
    .filter((lot) => lot.locationKind === "store")
    .map((lot) => ({
      productId: lot.productId,
      productName: lot.productName,
      quantity: lot.quantity,
      expiresAt: lot.expiresAt,
      warningDays: lot.warningDays,
    }));

  return (
    <PosScreen
      cashierId={session.user.id}
      shelfExpiry={shelfExpiry}
      // Boxes and displays: scanned by mistake at the till, they are
      // recognized and the cashier is told to charge the unit instead.
      boxCodes={presentations
        .filter((p) => p.isActive && p.barcode)
        .map((p) => ({ id: p.id, productId: p.productId, barcode: p.barcode, name: p.name }))}
      catalogAt={new Date().toISOString()}
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        categoryId: p.categoryId,
        categoryName: p.categoryName,
        categoryIcon: p.categoryIcon,
        priceSale: p.priceSale,
        workerDiscountAmount: p.workerDiscountAmount,
        imageUrl: p.imageUrl,
      }))}
    />
  );
}

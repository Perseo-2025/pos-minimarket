import { redirect } from "next/navigation";
import { listActiveProductsUseCase } from "@/application/use-cases/products/list-products";
import { PosScreen } from "@/components/pos/pos-screen";
import { auth } from "@/infrastructure/auth";
import { productRepository } from "@/infrastructure/repositories";

export default async function PosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const products = await listActiveProductsUseCase(productRepository);

  return (
    <PosScreen
      cashierId={session.user.id}
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        categoryId: p.categoryId,
        categoryName: p.categoryName,
        categoryIcon: p.categoryIcon,
        priceSale: p.priceSale,
        workerDiscountPercent: p.workerDiscountPercent,
        imageUrl: p.imageUrl,
      }))}
    />
  );
}

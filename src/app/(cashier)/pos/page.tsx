import { listActiveProductsUseCase } from "@/application/use-cases/products/list-products";
import { PosScreen } from "@/components/pos/pos-screen";
import { productRepository } from "@/infrastructure/repositories";

export default async function PosPage() {
  const products = await listActiveProductsUseCase(productRepository);

  return (
    <PosScreen
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        priceSale: p.priceSale,
        imageUrl: p.imageUrl,
      }))}
    />
  );
}

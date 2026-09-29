import { Suspense } from "react";
import { listAllProductsUseCase } from "@/application/use-cases/products/list-products";
import { Button } from "@/components/ui/button";
import { ProductForm } from "@/components/admin/product-form";
import { ProductTable } from "@/components/admin/product-table";
import { productRepository } from "@/infrastructure/repositories";

async function ProductsList() {
  const products = await listAllProductsUseCase(productRepository);

  return (
    <ProductTable
      products={products.map((p) => ({
        ...p,
        priceSale: p.priceSale.toString(),
      }))}
    />
  );
}

export default function AdminProductsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Productos</h1>
        <ProductForm trigger={<Button>Nuevo producto</Button>} />
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Cargando...</p>}>
        <ProductsList />
      </Suspense>
    </div>
  );
}

import { PlusIcon } from "lucide-react";
import { Suspense } from "react";
import { listCategoriesWithCountsUseCase } from "@/application/use-cases/categories/list-categories";
import { listAllProductsUseCase } from "@/application/use-cases/products/list-products";
import { PageHeader } from "@/components/admin/page-header";
import { ProductCategoryFilter } from "@/components/admin/product-category-filter";
import {
  type CategoryOption,
  ProductForm,
} from "@/components/admin/product-form";
import { ProductTable } from "@/components/admin/product-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  categoryRepository,
  productRepository,
} from "@/infrastructure/repositories";

async function ProductsContent({ categoryParam }: { categoryParam: unknown }) {
  const [products, categories] = await Promise.all([
    listAllProductsUseCase(productRepository),
    listCategoriesWithCountsUseCase(categoryRepository),
  ]);

  const options: CategoryOption[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    isActive: c.isActive,
  }));
  // Unknown ids (stale link, deleted row) just show everything.
  const selected = options.find((c) => c.id === categoryParam) ?? null;
  const visible = selected
    ? products.filter((p) => p.categoryId === selected.id)
    : products;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={selected ? `Productos · ${selected.name}` : "Productos"}
        description={
          selected
            ? `${visible.length} ${visible.length === 1 ? "producto" : "productos"} en esta categoría.`
            : "Catálogo de productos disponibles en caja."
        }
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <ProductCategoryFilter
              categories={options}
              selected={selected?.id ?? null}
            />
            <ProductForm
              categories={options}
              defaultCategoryId={selected?.id}
              trigger={
                <Button>
                  <PlusIcon data-icon="inline-start" />
                  Nuevo Producto
                </Button>
              }
            />
          </div>
        }
      />
      <ProductTable
        // Remount on filter change so pagination starts again at page 1.
        key={selected?.id ?? "all"}
        categories={options}
        products={visible.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          categoryId: p.categoryId,
          categoryName: p.categoryName,
          categoryIcon: p.categoryIcon,
          priceSale: p.priceSale.toString(),
          workerDiscountPercent: p.workerDiscountPercent,
          imageUrl: p.imageUrl,
          isActive: p.isActive,
        }))}
      />
    </div>
  );
}

export default async function AdminProductsPage({
  searchParams,
}: PageProps<"/admin/products">) {
  const { category } = await searchParams;

  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <ProductsContent categoryParam={category} />
    </Suspense>
  );
}

import { PackageOpenIcon, PlusIcon, TagsIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { listCategoriesWithCountsUseCase } from "@/application/use-cases/categories/list-categories";
import { getInventoryUseCase } from "@/application/use-cases/inventory/get-inventory";
import { listAllProductsUseCase } from "@/application/use-cases/products/list-products";
import { listPresentationsUseCase } from "@/application/use-cases/products/save-presentation";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/empty-state";
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
  inventoryRepository,
  presentationRepository,
  productRepository,
} from "@/infrastructure/repositories";

async function ProductsContent({ categoryParam }: { categoryParam: unknown }) {
  const [products, categories, inventory, presentations] = await Promise.all([
    listAllProductsUseCase(productRepository),
    listCategoriesWithCountsUseCase(categoryRepository),
    getInventoryUseCase(inventoryRepository),
    listPresentationsUseCase(presentationRepository),
  ]);
  // Total units across Almacén + Tienda; null until the first count.
  const stockById = new Map(
    inventory.stock.map((s) => [s.productId, s.trackStock ? s.total : null]),
  );

  const options: CategoryOption[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    isActive: c.isActive,
    tracksExpiry: c.tracksExpiry,
  }));
  // Unknown ids (stale link, deleted row) just show everything.
  const selected = options.find((c) => c.id === Number(categoryParam)) ?? null;
  const visible = selected
    ? products.filter((p) => p.categoryId === selected.id)
    : products;

  if (categories.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Productos" description="Catálogo de tu tienda." />
        <EmptyState
          icon={TagsIcon}
          title="Primero crea una categoría"
          description="Cada producto pertenece a una categoría (Bebidas, Snacks…). Crea al menos una y vuelve aquí para registrar tus productos."
          action={
            <Button
              nativeButton={false}
              render={<Link href="/admin/categories" />}
            >
              Ir a Categorías
            </Button>
          }
        />
      </div>
    );
  }

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
      {products.length === 0 && (
        <EmptyState
          icon={PackageOpenIcon}
          title="Aún no hay productos"
          description="Registra el primero con su precio de compra y de venta. Aparecerá en caja cuando tenga stock en la Tienda."
          action={
            <ProductForm
              categories={options}
              trigger={
                <Button>
                  <PlusIcon data-icon="inline-start" />
                  Registrar mi primer producto
                </Button>
              }
            />
          }
        />
      )}
      {products.length > 0 && (
        <ProductTable
          // Remount on filter change so pagination starts again at page 1.
          key={selected?.id ?? "all"}
          categories={options}
          products={visible.map((p) => ({
            id: p.id,
            name: p.name,
            barcode: p.barcode,
            description: p.description,
            categoryId: p.categoryId,
            categoryName: p.categoryName,
            categoryIcon: p.categoryIcon,
            priceSale: p.priceSale.toString(),
            priceCost: p.priceCost === null ? null : p.priceCost.toString(),
            tracksExpiry: p.tracksExpiryOverride,
            workerDiscountAmount: p.workerDiscountAmount,
            stock: stockById.get(p.id) ?? null,
            presentations: presentations.filter((x) => x.productId === p.id),
            imageUrl: p.imageUrl,
            isActive: p.isActive,
          }))}
        />
      )}
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

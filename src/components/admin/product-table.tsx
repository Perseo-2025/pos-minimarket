"use client";

import { PencilIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { deactivateProduct, reactivateProduct } from "@/actions/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { usePagination } from "@/hooks/use-pagination";
import { CategoryGlyph } from "@/components/pos/category-glyph";
import { ProductImagePlaceholder } from "@/components/pos/product-image-placeholder";
import { formatSoles } from "@/lib/money";
import { DataTable } from "./data-table";
import { DataTablePagination } from "./data-table-pagination";
import { type CategoryOption, ProductForm } from "./product-form";
import { StatusBadge } from "./status-badge";

type Product = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  priceSale: string;
  workerDiscountPercent: number;
  imageUrl: string | null;
  isActive: boolean;
};

const COLUMNS = [
  { label: "Producto" },
  { label: "Categoría" },
  { label: "Precio", className: "text-right" },
  { label: "Estado" },
  { label: "Acciones", className: "text-right" },
];

export function ProductTable({
  products,
  categories,
}: {
  products: Product[];
  categories: CategoryOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const pagination = usePagination(products);

  function handleToggleActive(product: Product) {
    startTransition(async () => {
      try {
        if (product.isActive) {
          await deactivateProduct(product.id);
          toast.success(`${product.name} desactivado`);
        } else {
          await reactivateProduct(product.id);
          toast.success(`${product.name} reactivado`);
        }
      } catch {
        toast.error("No se pudo actualizar el producto");
      }
    });
  }

  return (
    <DataTable
      columns={COLUMNS}
      isEmpty={products.length === 0}
      emptyMessage="No hay productos en esta vista."
      footer={
        <DataTablePagination
          {...pagination}
          onPageChange={pagination.setPage}
          itemLabel="productos"
        />
      }
    >
      {pagination.rows.map((product) => (
        <TableRow key={product.id}>
          <TableCell className="max-w-80">
            <div className="flex items-center gap-3">
              <ProductImagePlaceholder
                src={product.imageUrl}
                alt={product.name}
                className="w-14 shrink-0 [&_svg]:size-5"
              />
              <div className="min-w-0">
                <div className="truncate font-medium">{product.name}</div>
                {product.description && (
                  <div className="truncate text-xs text-muted-foreground">
                    {product.description}
                  </div>
                )}
              </div>
            </div>
          </TableCell>
          <TableCell>
            <Badge variant="outline">
              <CategoryGlyph icon={product.categoryIcon} />
              {product.categoryName}
            </Badge>
          </TableCell>
          <TableCell className="text-right tabular-nums">
            <div className="font-medium">{formatSoles(product.priceSale)}</div>
            {product.workerDiscountPercent > 0 && (
              <div className="text-xs text-emerald-700 dark:text-emerald-400">
                Trabajador −{product.workerDiscountPercent}%
              </div>
            )}
          </TableCell>
          <TableCell>
            <StatusBadge active={product.isActive} />
          </TableCell>
          <TableCell>
            <div className="flex justify-end gap-2">
              <ProductForm
                product={product}
                categories={categories}
                trigger={
                  <Button size="sm" variant="outline">
                    <PencilIcon data-icon="inline-start" />
                    Editar
                  </Button>
                }
              />
              <Button
                size="sm"
                variant={product.isActive ? "ghost" : "outline"}
                className={
                  product.isActive
                    ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                    : undefined
                }
                disabled={isPending}
                onClick={() => handleToggleActive(product)}
              >
                {product.isActive ? "Desactivar" : "Reactivar"}
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </DataTable>
  );
}

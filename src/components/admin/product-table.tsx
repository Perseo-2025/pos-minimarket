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
import type { Presentation } from "@/domain/entities/presentation";
import { productMargin } from "@/domain/services/product-margin";
import { formatSoles } from "@/lib/money";
import { cn } from "@/lib/utils";
import { DataTable, ID_COLUMN, IdCell } from "./data-table";
import { DataTablePagination } from "./data-table-pagination";
import { DeactivateButton } from "./deactivate-button";
import { PresentationsDialog } from "./presentations-dialog";
import { type CategoryOption, ProductForm } from "./product-form";
import { StatusBadge } from "./status-badge";

type Product = {
  id: number;
  name: string;
  barcode: string | null;
  description: string | null;
  categoryId: number;
  categoryName: string;
  categoryIcon: string | null;
  priceSale: string;
  priceCost: string | null;
  tracksExpiry: boolean | null;
  workerDiscountAmount: number;
  // Units across all locations; null = stock not tracked yet (no count).
  stock: number | null;
  presentations: Presentation[];
  imageUrl: string | null;
  isActive: boolean;
};

const COLUMNS = [
  ID_COLUMN,
  { label: "Producto" },
  { label: "Categoría" },
  { label: "P. compra", className: "text-right" },
  { label: "P. venta", className: "text-right" },
  { label: "Utilidad", className: "text-right" },
  { label: "Stock", className: "text-right" },
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
          <IdCell id={product.id} />
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
                {product.presentations.some((p) => p.isActive) && (
                  <div className="truncate text-xs text-muted-foreground">
                    {product.presentations
                      .filter((p) => p.isActive)
                      .map((p) => `${p.name} ×${p.unitsTotal}`)
                      .join(" · ")}
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
          <TableCell className="text-right tabular-nums text-muted-foreground">
            {product.priceCost === null ? "—" : formatSoles(product.priceCost)}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            <div className="font-medium">{formatSoles(product.priceSale)}</div>
            {product.workerDiscountAmount > 0 && (
              <div className="text-xs text-emerald-700 dark:text-emerald-400">
                Trabajador −{formatSoles(product.workerDiscountAmount)}
              </div>
            )}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            <ProfitCell priceSale={product.priceSale} priceCost={product.priceCost} />
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {product.stock === null ? (
              <span className="text-xs text-muted-foreground">Sin conteo</span>
            ) : (
              <span
                className={cn(
                  "font-medium",
                  product.stock <= 0 && "text-destructive",
                )}
              >
                {product.stock}
              </span>
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
              <PresentationsDialog
                productId={product.id}
                productName={product.name}
                presentations={product.presentations}
              />
              {product.isActive ? (
                <DeactivateButton
                  label={`Desactivar ${product.name}`}
                  disabled={isPending}
                  onClick={() => handleToggleActive(product)}
                />
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => handleToggleActive(product)}
                >
                  Reactivar
                </Button>
              )}
            </div>
          </TableCell>
        </TableRow>
      ))}
    </DataTable>
  );
}

function ProfitCell({
  priceSale,
  priceCost,
}: {
  priceSale: string;
  priceCost: string | null;
}) {
  const margin = productMargin(
    Number(priceSale),
    priceCost === null ? null : Number(priceCost),
  );
  if (!margin) return <span className="text-muted-foreground">—</span>;
  return (
    <>
      <div
        className={cn(
          "font-medium",
          margin.profit < 0
            ? "text-destructive"
            : "text-emerald-700 dark:text-emerald-400",
        )}
      >
        {formatSoles(margin.profit)}
      </div>
      <div className="text-xs text-muted-foreground">
        {margin.markupPercent}% sobre costo
      </div>
    </>
  );
}

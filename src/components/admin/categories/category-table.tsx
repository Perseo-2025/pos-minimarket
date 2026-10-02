"use client";

import { PencilIcon } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { setCategoryActive } from "@/actions/categories";
import { CategoryGlyph } from "@/components/pos/category-glyph";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import type { CategoryWithCounts } from "@/domain/entities/category";
import { usePagination } from "@/hooks/use-pagination";
import { DataTable, ID_COLUMN, IdCell } from "../data-table";
import { DataTablePagination } from "../data-table-pagination";
import { DeactivateButton } from "../deactivate-button";
import { StatusBadge } from "../status-badge";
import { CategoryForm } from "./category-form";

const COLUMNS = [
  ID_COLUMN,
  { label: "Orden", className: "w-16 text-right" },
  { label: "Categoría" },
  { label: "Productos" },
  { label: "Proveedores" },
  { label: "Estado" },
  { label: "Acciones", className: "text-right" },
];

export function CategoryTable({
  categories,
}: {
  categories: CategoryWithCounts[];
}) {
  const [isPending, startTransition] = useTransition();
  const pagination = usePagination(categories);

  function toggle(category: CategoryWithCounts) {
    startTransition(async () => {
      const result = await setCategoryActive(category.id, !category.isActive);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        category.isActive
          ? `${category.name} desactivada`
          : `${category.name} activada`,
      );
    });
  }

  return (
    <DataTable
      columns={COLUMNS}
      isEmpty={categories.length === 0}
      emptyMessage="Aún no hay categorías. Crea la primera para empezar a agregar productos."
      footer={
        <DataTablePagination
          {...pagination}
          onPageChange={pagination.setPage}
          itemLabel="categorías"
        />
      }
    >
      {pagination.rows.map((category) => {
        const active = category.activeProductCount;

        return (
          <TableRow key={category.id}>
            <IdCell id={category.id} />
            <TableCell className="text-right text-muted-foreground tabular-nums">
              {category.sortOrder}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <CategoryGlyph icon={category.icon} className="size-5" />
                </span>
                <div className="leading-tight">
                  <div className="font-medium">{category.name}</div>
                  {category.tracksExpiry && (
                    <div className="text-xs text-muted-foreground">
                      Vence · avisa {category.expiryWarningDays} días antes
                    </div>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell>
              {category.productCount === 0 ? (
                <span className="text-muted-foreground">Sin productos</span>
              ) : (
                <Link
                  href={`/admin/products?category=${category.id}`}
                  className="group inline-flex flex-col leading-tight"
                >
                  <span className="font-medium tabular-nums group-hover:underline">
                    {category.productCount}{" "}
                    {category.productCount === 1 ? "producto" : "productos"}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {active} {active === 1 ? "activo" : "activos"} · Ver
                    productos
                  </span>
                </Link>
              )}
            </TableCell>
            <TableCell className="max-w-56">
              {category.suppliers.length === 0 ? (
                <Link
                  href="/admin/suppliers"
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Sin proveedor · Asignar
                </Link>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {category.suppliers.map((supplier) => (
                    <Badge key={supplier.id} variant="outline">
                      {supplier.name}
                    </Badge>
                  ))}
                </div>
              )}
            </TableCell>
            <TableCell>
              <StatusBadge active={category.isActive} />
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-2">
                <CategoryForm
                  category={category}
                  trigger={
                    <Button size="sm" variant="outline">
                      <PencilIcon data-icon="inline-start" />
                      Editar
                    </Button>
                  }
                />
                {!category.isActive ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => toggle(category)}
                  >
                    Activar
                  </Button>
                ) : active === 0 ? (
                  <DeactivateButton
                    label={`Desactivar ${category.name}`}
                    disabled={isPending}
                    onClick={() => toggle(category)}
                  />
                ) : (
                  // Deactivating hides its products from the POS — confirm.
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <DeactivateButton
                          label={`Desactivar ${category.name}`}
                          disabled={isPending}
                        />
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          ¿Desactivar {category.name}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {active === 1
                            ? "1 producto activo dejará"
                            : `${active} productos activos dejarán`}{" "}
                          de aparecer en caja hasta que vuelvas a activar la
                          categoría. No se borra nada.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-white hover:bg-destructive/90"
                          onClick={() => toggle(category)}
                        >
                          Desactivar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </TableCell>
          </TableRow>
        );
      })}
    </DataTable>
  );
}

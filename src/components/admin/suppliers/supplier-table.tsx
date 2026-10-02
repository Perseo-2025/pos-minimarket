"use client";

import { PencilIcon, PhoneIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { setSupplierActive } from "@/actions/suppliers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import type { Supplier } from "@/domain/entities/supplier";
import { usePagination } from "@/hooks/use-pagination";
import { DataTable, ID_COLUMN, IdCell } from "../data-table";
import { DataTablePagination } from "../data-table-pagination";
import { DeactivateButton } from "../deactivate-button";
import { StatusBadge } from "../status-badge";
import { type SupplierCategoryOption, SupplierForm } from "./supplier-form";

const COLUMNS = [
  ID_COLUMN,
  { label: "RUC" },
  { label: "Proveedor" },
  { label: "Categorías" },
  { label: "Contacto" },
  { label: "Estado" },
  { label: "Acciones", className: "text-right" },
];

export function SupplierTable({
  suppliers,
  categories,
}: {
  suppliers: Supplier[];
  categories: SupplierCategoryOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const pagination = usePagination(suppliers);

  function toggle(supplier: Supplier) {
    startTransition(async () => {
      const result = await setSupplierActive(supplier.id, !supplier.isActive);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const name = supplier.tradeName ?? supplier.businessName;
      toast.success(
        supplier.isActive ? `${name} desactivado` : `${name} activado`,
      );
    });
  }

  return (
    <DataTable
      columns={COLUMNS}
      isEmpty={suppliers.length === 0}
      emptyMessage="Aún no hay proveedores. Registra el primero con su RUC."
      footer={
        <DataTablePagination
          {...pagination}
          onPageChange={pagination.setPage}
          itemLabel="proveedores"
        />
      }
    >
      {pagination.rows.map((supplier) => (
        <TableRow key={supplier.id}>
          <IdCell id={supplier.id} />
          <TableCell className="font-mono text-xs">
            {supplier.ruc ?? (
              <span className="font-sans text-muted-foreground">Sin RUC</span>
            )}
          </TableCell>
          <TableCell className="max-w-72">
            <div className="truncate font-medium">
              {supplier.tradeName ?? supplier.businessName}
            </div>
            {supplier.tradeName && (
              <div className="truncate text-xs text-muted-foreground">
                {supplier.businessName}
              </div>
            )}
          </TableCell>
          <TableCell className="max-w-64">
            {supplier.categories.length === 0 ? (
              <span className="text-xs text-muted-foreground">Sin asignar</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {supplier.categories.map((category) => (
                  <Badge key={category.id} variant="outline">
                    {category.name}
                  </Badge>
                ))}
              </div>
            )}
          </TableCell>
          <TableCell className="text-sm">
            {supplier.contactName || supplier.phone ? (
              <>
                {supplier.contactName && <div>{supplier.contactName}</div>}
                {supplier.phone && (
                  <a
                    href={`tel:${supplier.phone.replace(/\s/g, "")}`}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                  >
                    <PhoneIcon className="size-3" />
                    {supplier.phone}
                  </a>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </TableCell>
          <TableCell>
            <StatusBadge active={supplier.isActive} />
          </TableCell>
          <TableCell>
            <div className="flex justify-end gap-2">
              <SupplierForm
                supplier={supplier}
                categories={categories}
                trigger={
                  <Button size="sm" variant="outline">
                    <PencilIcon data-icon="inline-start" />
                    Editar
                  </Button>
                }
              />
              {supplier.isActive ? (
                <DeactivateButton
                  label={`Desactivar ${supplier.tradeName ?? supplier.businessName}`}
                  disabled={isPending}
                  onClick={() => toggle(supplier)}
                />
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => toggle(supplier)}
                >
                  Activar
                </Button>
              )}
            </div>
          </TableCell>
        </TableRow>
      ))}
    </DataTable>
  );
}

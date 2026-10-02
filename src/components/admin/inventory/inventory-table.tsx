"use client";

import { ClipboardListIcon, HistoryIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { usePagination } from "@/hooks/use-pagination";
import type { StockLot } from "@/domain/entities/inventory";
import { cn } from "@/lib/utils";
import { DataTable, ID_COLUMN, IdCell } from "../data-table";
import { DataTablePagination } from "../data-table-pagination";
import { type LocationOption, StockCountDialog } from "./stock-count-dialog";

export type InventoryRow = {
  productId: number;
  productName: string;
  categoryName: string;
  isActive: boolean;
  trackStock: boolean;
  // Keyed by location id.
  byLocation: Record<number, number>;
  total: number;
  tracksExpiry: boolean;
  lots: StockLot[];
};

export function Quantity({ value }: { value: number | undefined }) {
  if (value === undefined) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("tabular-nums", value < 0 && "font-semibold text-destructive")}>
      {value}
    </span>
  );
}

export function InventoryTable({
  rows,
  locations,
}: {
  rows: InventoryRow[];
  locations: LocationOption[];
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? rows.filter(
        (r) =>
          r.productName.toLowerCase().includes(needle) ||
          r.categoryName.toLowerCase().includes(needle),
      )
    : rows;
  const pagination = usePagination(visible);

  const columns = [
    ID_COLUMN,
    { label: "Producto" },
    ...locations.map((l) => ({ label: l.name, className: "text-right" })),
    { label: "Total", className: "text-right" },
    { label: "Control" },
    { label: "Acciones", className: "text-right" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar producto o categoría"
          className="pl-8"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            pagination.setPage(1);
          }}
        />
      </div>
      <DataTable
        columns={columns}
        isEmpty={visible.length === 0}
        emptyMessage="No hay productos en esta vista."
        footer={
          <DataTablePagination
            {...pagination}
            onPageChange={pagination.setPage}
            itemLabel="productos"
          />
        }
      >
        {pagination.rows.map((row) => (
          <TableRow key={row.productId} className={cn(!row.isActive && "opacity-60")}>
            <IdCell id={row.productId} />
            <TableCell className="max-w-72">
              <div className="truncate font-medium">{row.productName}</div>
              <div className="truncate text-xs text-muted-foreground">
                {row.categoryName}
                {!row.isActive && " · inactivo"}
              </div>
            </TableCell>
            {locations.map((l) => (
              <TableCell key={l.id} className="text-right">
                <Quantity value={row.trackStock ? row.byLocation[l.id] : undefined} />
              </TableCell>
            ))}
            <TableCell className="text-right font-medium">
              <Quantity value={row.trackStock ? row.total : undefined} />
            </TableCell>
            <TableCell>
              {row.trackStock ? (
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                >
                  Controlado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Sin conteo inicial
                </Badge>
              )}
              {row.trackStock && row.tracksExpiry && row.lots.length === 0 && (
                <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  Falta registrar fechas
                </div>
              )}
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-2">
                <StockCountDialog
                  productId={row.productId}
                  productName={row.productName}
                  byLocation={row.byLocation}
                  locations={locations}
                  tracksExpiry={row.tracksExpiry}
                  lots={row.lots}
                  trigger={
                    <Button size="sm" variant="outline">
                      <ClipboardListIcon data-icon="inline-start" />
                      Contar
                    </Button>
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  nativeButton={false}
                  render={<Link href={`/admin/inventory/${row.productId}`} />}
                >
                  <HistoryIcon data-icon="inline-start" />
                  Kardex
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </DataTable>
    </div>
  );
}

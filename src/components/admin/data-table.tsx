"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataTableColumn = {
  label: string;
  className?: string;
};

// Every admin table starts with the record's numeric id (id_<entity>).
export const ID_COLUMN: DataTableColumn = { label: "ID", className: "w-16" };

export function IdCell({ id }: { id: number }) {
  return (
    <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
      {id}
    </TableCell>
  );
}

// Sales show their id as the order number: the autoincrement id the
// server gives on sync, the one to look a purchase up by.
export const ORDER_COLUMN: DataTableColumn = { label: "N° Orden", className: "w-20" };

export function OrderCell({ id }: { id: number }) {
  return (
    <TableCell className="font-mono text-sm font-medium tabular-nums">#{id}</TableCell>
  );
}

// Shared chrome for every admin table: bordered card, muted header, empty
// state and a footer slot (pagination). Rows are rendered by the caller.
export function DataTable({
  columns,
  isEmpty,
  emptyMessage = "No hay registros para mostrar.",
  footer,
  children,
}: {
  columns: DataTableColumn[];
  isEmpty: boolean;
  emptyMessage?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead
                key={column.label}
                className={cn(
                  "h-11 px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase",
                  column.className,
                )}
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="[&_td]:px-4 [&_td]:py-3">
          {isEmpty ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="h-32 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            children
          )}
        </TableBody>
      </Table>
      {footer}
    </div>
  );
}

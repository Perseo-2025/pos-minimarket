"use client";

import { useState } from "react";
import {
  CAPTURE_SOURCE_LABELS,
  type CaptureSource,
} from "@/domain/value-objects/capture-source";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  AUDIT_FLAG_HELP,
  AUDIT_FLAG_LABELS,
  type AuditFlag,
  INFO_AUDIT_FLAGS,
} from "@/domain/entities/audit";
import { PAYMENT_TYPE_LABELS, type PaymentType } from "@/domain/entities/sale";
import {
  WORKER_VERIFICATION_LABELS,
  type WorkerVerification,
} from "@/domain/entities/worker";
import { usePagination } from "@/hooks/use-pagination";
import { formatSoles } from "@/lib/money";
import { DataTable, ID_COLUMN, IdCell } from "../data-table";
import { DataTablePagination } from "../data-table-pagination";

export type SaleRow = {
  // id_sale: also the ticket number.
  id: number;
  createdAt: string;
  cashierName: string;
  paymentType: PaymentType;
  subtotal: number;
  discountTotal: number;
  discountPercent: number;
  courtesyTotal: number;
  courtesyApprovedByName: string | null;
  total: number;
  workerName: string | null;
  workerDni: string | null;
  workerVerification: WorkerVerification;
  pointsEarned: number;
  auditFlags: AuditFlag[];
  units: number;
  items: {
    id: number;
    productName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    discountPercent: number;
    discountAmount: number;
    isCourtesy: boolean;
    captureSource: CaptureSource | null;
  }[];
};

const COLUMNS = [
  ID_COLUMN,
  { label: "Hora" },
  { label: "Cajero" },
  { label: "Productos", className: "text-right" },
  { label: "Método" },
  { label: "Trabajador" },
  { label: "Total", className: "text-right" },
];

const alertFlags = (sale: SaleRow) =>
  sale.auditFlags.filter((flag) => !INFO_AUDIT_FLAGS.includes(flag));

const timeFormat = new Intl.DateTimeFormat("es-PE", {
  hour: "2-digit",
  minute: "2-digit",
});
const dateTimeFormat = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "long",
  timeStyle: "short",
});


export function SalesTable({ sales }: { sales: SaleRow[] }) {
  const pagination = usePagination(sales);
  const [selected, setSelected] = useState<SaleRow | null>(null);

  return (
    <>
      <DataTable
        columns={COLUMNS}
        isEmpty={sales.length === 0}
        emptyMessage="No se registraron ventas en esta fecha."
        footer={
          <DataTablePagination
            {...pagination}
            onPageChange={pagination.setPage}
            itemLabel="ventas"
          />
        }
      >
        {pagination.rows.map((sale) => (
          <TableRow
            key={sale.id}
            tabIndex={0}
            aria-label={`Ver detalle del ticket ${sale.id}`}
            className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none"
            onClick={() => setSelected(sale)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelected(sale);
              }
            }}
          >
            <IdCell id={sale.id} />
            <TableCell className="text-muted-foreground tabular-nums">
              {timeFormat.format(new Date(sale.createdAt))}
            </TableCell>
            <TableCell>{sale.cashierName}</TableCell>
            <TableCell className="text-right tabular-nums">
              {sale.units}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{PAYMENT_TYPE_LABELS[sale.paymentType]}</Badge>
            </TableCell>
            <TableCell className="text-sm">
              {sale.workerName ? (
                <div className="leading-tight">
                  <div className="max-w-40 truncate">{sale.workerName}</div>
                  {sale.discountTotal > 0 && (
                    <div className="text-xs text-emerald-700 tabular-nums dark:text-emerald-400">
                      −{formatSoles(sale.discountTotal)}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
              {sale.courtesyTotal > 0 && (
                <div className="text-xs font-medium text-brand-orange tabular-nums">
                  Cortesía −{formatSoles(sale.courtesyTotal)}
                </div>
              )}
              {alertFlags(sale).length > 0 && (
                <Badge variant="destructive" className="mt-1">
                  {alertFlags(sale).length === 1
                    ? "1 alerta"
                    : `${alertFlags(sale).length} alertas`}
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {formatSoles(sale.total)}
            </TableCell>
          </TableRow>
        ))}
      </DataTable>

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <SheetContent className="w-full sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Ticket #{selected.id}</SheetTitle>
                <SheetDescription>
                  {dateTimeFormat.format(new Date(selected.createdAt))}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
                <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Cajero</dt>
                    <dd className="font-medium">{selected.cashierName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Método de pago
                    </dt>
                    <dd className="font-medium">
                      {PAYMENT_TYPE_LABELS[selected.paymentType]}
                    </dd>
                  </div>
                  {selected.workerName && (
                    <div className="col-span-2">
                      <dt className="text-xs text-muted-foreground">
                        Trabajador del aeropuerto
                      </dt>
                      <dd className="font-medium">
                        {selected.workerName}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          · DNI {selected.workerDni}
                        </span>
                      </dd>
                      <dd className="text-xs text-muted-foreground">
                        {WORKER_VERIFICATION_LABELS[selected.workerVerification]} · +
                        {selected.pointsEarned} puntos
                      </dd>
                    </div>
                  )}
                </dl>

                {alertFlags(selected).length > 0 && (
                  <div className="space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                    <p className="font-semibold text-destructive">Alertas de auditoría</p>
                    <ul className="space-y-1">
                      {alertFlags(selected).map((flag) => (
                        <li key={flag}>
                          <span className="font-medium">{AUDIT_FLAG_LABELS[flag]}:</span>{" "}
                          <span className="text-muted-foreground">{AUDIT_FLAG_HELP[flag]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <ul className="divide-y">
                  {selected.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {item.productName}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {item.quantity} × {formatSoles(item.unitPrice)}
                          {item.captureSource &&
                            ` · ${CAPTURE_SOURCE_LABELS[item.captureSource]}`}
                        </p>
                        {item.isCourtesy ? (
                          <p className="text-xs font-medium text-brand-orange">
                            Cortesía (regalado)
                          </p>
                        ) : (
                          item.discountAmount > 0 && (
                            <p className="text-xs text-emerald-700 tabular-nums dark:text-emerald-400">
                              −{item.discountPercent}% trabajador · −
                              {formatSoles(item.discountAmount)}
                            </p>
                          )
                        )}
                      </div>
                      <span className="text-right font-medium tabular-nums">
                        {item.isCourtesy || item.discountAmount > 0 ? (
                          <>
                            <s className="block text-xs font-normal text-muted-foreground">
                              {formatSoles(item.lineTotal)}
                            </s>
                            {formatSoles(
                              item.isCourtesy ? 0 : item.lineTotal - item.discountAmount,
                            )}
                          </>
                        ) : (
                          formatSoles(item.lineTotal)
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-auto px-4 pb-4">
                <Separator className="mb-4" />
                {(selected.discountTotal > 0 || selected.courtesyTotal > 0) && (
                  <div className="mb-2 space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="tabular-nums">{formatSoles(selected.subtotal)}</span>
                    </div>
                    {selected.discountTotal > 0 && (
                      <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                        <span>
                          Descuento trabajador
                          {selected.discountPercent > 0 && ` (${selected.discountPercent}%)`}
                        </span>
                        <span className="tabular-nums">
                          −{formatSoles(selected.discountTotal)}
                        </span>
                      </div>
                    )}
                    {selected.courtesyTotal > 0 && (
                      <div className="flex justify-between text-brand-orange">
                        <span>
                          Cortesía
                          {selected.courtesyApprovedByName &&
                            ` · aprobó ${selected.courtesyApprovedByName}`}
                        </span>
                        <span className="tabular-nums">
                          −{formatSoles(selected.courtesyTotal)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Total ({selected.units}{" "}
                    {selected.units === 1 ? "unidad" : "unidades"})
                  </span>
                  <span className="text-xl font-semibold tabular-nums">
                    {formatSoles(selected.total)}
                  </span>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

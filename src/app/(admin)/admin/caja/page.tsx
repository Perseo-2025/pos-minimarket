import { WalletIcon } from "lucide-react";
import { Suspense } from "react";
import { listShiftsUseCase } from "@/application/use-cases/cash/cash-shifts";
import { AuditRangeFilter } from "@/components/admin/audit/audit-range-filter";
import {
  Difference,
  ReviewShiftDialog,
} from "@/components/admin/cash/review-shift-dialog";
import { DataTable, ID_COLUMN, IdCell } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { CASH_SHIFT_STATUS_LABELS } from "@/domain/entities/cash-shift";
import { salesStillSyncing, shiftDifferences } from "@/domain/services/cash-shift";
import { storeDateKey, storeDayRange, STORE_TIME_ZONE } from "@/domain/value-objects/store-time";
import { cashShiftRepository } from "@/infrastructure/repositories";
import { parseDateRange } from "@/lib/date-range";
import { formatSoles } from "@/lib/money";
import { cn } from "@/lib/utils";

const dateTimeFormat = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: STORE_TIME_ZONE,
});

const COLUMNS = [
  ID_COLUMN,
  { label: "Cajero" },
  { label: "Turno" },
  { label: "Efectivo", className: "text-right" },
  { label: "Yape/Plin", className: "text-right" },
  { label: "Tarjeta", className: "text-right" },
  { label: "Estado" },
  { label: "", className: "text-right" },
];

const STATUS_TONES = {
  open: "text-sky-700 dark:text-sky-400",
  closed: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  reviewed: "text-muted-foreground",
} as const;

async function ShiftsContent({ from, to }: { from: string; to: string }) {
  const shifts = await listShiftsUseCase(
    cashShiftRepository,
    storeDayRange(from).from,
    storeDayRange(to).to,
  );

  if (shifts.length === 0) {
    return (
      <EmptyState
        icon={WalletIcon}
        title="No hay turnos en estas fechas"
        description="Cada cajero abre caja al empezar su turno y la cierra al terminar. Aquí verás si el dinero cuadra."
      />
    );
  }

  return (
    <DataTable columns={COLUMNS} isEmpty={false}>
      {shifts.map((shift) => {
        const diff = shift.counted ? shiftDifferences(shift.counted, shift.expected) : null;
        return (
          <TableRow key={shift.id}>
            <IdCell id={shift.id} />
            <TableCell className="font-medium">{shift.cashierName}</TableCell>
            <TableCell className="text-sm text-muted-foreground tabular-nums">
              {dateTimeFormat.format(shift.openedAt)}
              <div>
                {shift.closedAt ? `→ ${dateTimeFormat.format(shift.closedAt)}` : "sigue abierta"}
              </div>
            </TableCell>
            <TableCell className="text-right text-sm tabular-nums">
              {shift.counted ? (
                <>
                  <div className="text-muted-foreground">
                    {formatSoles(shift.expected.cash)} / {formatSoles(shift.counted.cash)}
                  </div>
                  <Difference value={diff!.cash} />
                </>
              ) : (
                <span className="text-muted-foreground">
                  inicial {formatSoles(shift.totals.openingCash)}
                </span>
              )}
            </TableCell>
            <TableCell className="text-right text-sm">
              {diff ? <Difference value={diff.yape} /> : "—"}
            </TableCell>
            <TableCell className="text-right text-sm">
              {diff ? <Difference value={diff.card} /> : "—"}
            </TableCell>
            <TableCell>
              <Badge variant="outline" className={cn(STATUS_TONES[shift.status])}>
                {CASH_SHIFT_STATUS_LABELS[shift.status]}
              </Badge>
              {shift.reviewNote && (
                <div className="mt-1 text-xs text-muted-foreground">{shift.reviewNote}</div>
              )}
            </TableCell>
            <TableCell className="text-right">
              {shift.counted && (
                <ReviewShiftDialog
                  shift={{
                    id: shift.id,
                    cashierName: shift.cashierName,
                    totals: shift.totals,
                    expected: shift.expected,
                    counted: shift.counted,
                    movements: shift.movements,
                    closeNote: shift.closeNote,
                    stillSyncing: salesStillSyncing(shift.reportedSales, shift.syncedSales),
                    reviewed: shift.status === "reviewed",
                  }}
                />
              )}
            </TableCell>
          </TableRow>
        );
      })}
    </DataTable>
  );
}

export default async function CashShiftsPage({ searchParams }: PageProps<"/admin/caja">) {
  const today = storeDateKey(new Date());
  const { from, to } = parseDateRange(await searchParams, today);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cierres de caja"
        description="Cada turno: con cuánto abrió, cuánto debía haber y cuánto se contó al cerrar."
        action={<AuditRangeFilter from={from} to={to} today={today} basePath="/admin/caja" />}
      />
      <Suspense key={`${from}-${to}`} fallback={<Skeleton className="h-96 rounded-xl" />}>
        <ShiftsContent from={from} to={to} />
      </Suspense>
    </div>
  );
}

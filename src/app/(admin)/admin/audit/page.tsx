import { AlertTriangleIcon, InfoIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { getAuditReportUseCase } from "@/application/use-cases/audit/get-audit-report";
import { listShiftsUseCase } from "@/application/use-cases/cash/cash-shifts";
import { AuditRangeFilter } from "@/components/admin/audit/audit-range-filter";
import { DataTable, ID_COLUMN, IdCell } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  AUDIT_EVENT_LABELS,
  AUDIT_FLAG_HELP,
  AUDIT_FLAG_LABELS,
  type AuditEventType,
  type CashierAuditSummary,
  INFO_AUDIT_FLAGS,
} from "@/domain/entities/audit";
import { round2 } from "@/domain/value-objects/money";
import { STORE_TIME_ZONE, storeDateKey, storeDayRange } from "@/domain/value-objects/store-time";
import {
  auditRepository,
  cashShiftRepository,
} from "@/infrastructure/repositories";
import { shiftDifferences } from "@/domain/services/cash-shift";
import { parseDateRange } from "@/lib/date-range";
import { formatSoles } from "@/lib/money";
import { cn } from "@/lib/utils";


const dateTimeFormat = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: STORE_TIME_ZONE,
});

// Events worth showing in the log (approvals etc. are shown too, they are
// part of the trail).
const EVENT_TONES: Partial<Record<AuditEventType, string>> = {
  worker_pin_failed: "text-destructive",
  worker_pin_reset_requested: "text-amber-700 dark:text-amber-400",
  worker_rejected: "text-muted-foreground",
  worker_suspended: "text-destructive",
  sold_without_stock: "text-amber-700 dark:text-amber-400",
  sold_expired: "text-destructive",
  stock_adjusted: "text-amber-700 dark:text-amber-400",
};

const EVENT_CHANNELS: Record<string, string> = {
  online: "en caja",
  offline: "en caja, sin internet",
  "mis-puntos": "en «Mis puntos»",
};

// A cashier "needs review" when their discount rate is well above the
// team's, or when there are failed PINs / anomalies. Heuristic, not proof.
function reviewReasons(row: CashierAuditSummary, averageRate: number) {
  const reasons: string[] = [];
  const rate = row.sales > 0 ? row.discountedSales / row.sales : 0;
  if (row.discountedSales >= 3 && averageRate > 0 && rate > averageRate * 1.5) {
    reasons.push("Da descuento más seguido que el resto");
  }
  if (row.pinFailures >= 3) reasons.push("Varias claves incorrectas");
  if (row.pinResets >= 2) reasons.push("Varios cambios de clave");
  if (row.flaggedSales > 0) reasons.push("Ventas con alertas");
  return reasons;
}

function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

async function AuditReport({ from, to }: { from: string; to: string }) {
  const range = { from: storeDayRange(from).from, to: storeDayRange(to).to };
  const [{ cashiers, flagged, events }, shifts] = await Promise.all([
    getAuditReportUseCase(auditRepository, range.from, range.to),
    listShiftsUseCase(cashShiftRepository, range.from, range.to),
  ]);
  // Cash missing at closing, per cashier (only what was short).
  const missingCash = new Map<number, number>();
  for (const shift of shifts) {
    if (!shift.counted) continue;
    const diff = shiftDifferences(shift.counted, shift.expected).cash;
    if (diff < 0) {
      missingCash.set(
        shift.cashierId,
        round2((missingCash.get(shift.cashierId) ?? 0) - diff),
      );
    }
  }

  const totals = cashiers.reduce(
    (acc, row) => ({
      sales: acc.sales + row.sales,
      discounted: acc.discounted + row.discountedSales,
      discount: round2(acc.discount + row.discountTotal),
      pinFailures: acc.pinFailures + row.pinFailures,
    }),
    { sales: 0, discounted: 0, discount: 0, pinFailures: 0 },
  );
  const averageRate = totals.sales > 0 ? totals.discounted / totals.sales : 0;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Ventas con descuento"
          value={`${totals.discounted}`}
          hint={`${percent(totals.discounted, totals.sales)}% de ${totals.sales} ventas`}
        />
        <Metric
          label="Descuento otorgado"
          value={formatSoles(totals.discount)}
          hint="Lo que dejaste de cobrar por el beneficio"
        />
        <Metric
          label="Ventas con alertas"
          value={`${flagged.length}`}
          hint="Revísalas en la tabla de abajo"
          warn={flagged.length > 0}
        />
        <Metric
          label="Claves incorrectas"
          value={`${totals.pinFailures}`}
          hint="Intentos fallidos en caja"
          warn={totals.pinFailures >= 3}
        />
      </div>

      <section className="flex flex-col gap-3">
        <SectionTitle
          title="Por cajero"
          description="Compara a tus cajeros. Si uno da descuento mucho más seguido que los demás, revisa sus ventas."
        />
        <DataTable
          columns={[
            ID_COLUMN,
            { label: "Cajero" },
            { label: "Ventas", className: "text-right" },
            { label: "Con descuento", className: "text-right" },
            { label: "Descuento dado", className: "text-right" },
            { label: "Sin internet", className: "text-right" },
            { label: "Claves fallidas", className: "text-right" },
            { label: "Cambios de clave", className: "text-right" },
            { label: "Faltante en caja", className: "text-right" },
            { label: "Revisar" },
          ]}
          isEmpty={cashiers.length === 0}
          emptyMessage="No hay ventas en este periodo."
        >
          {cashiers.map((row) => {
            const reasons = reviewReasons(row, averageRate);
            return (
              <TableRow key={row.cashierId} className={cn(reasons.length > 0 && "bg-amber-500/5")}>
                <IdCell id={row.cashierId} />
                <TableCell className="font-medium">{row.cashierName}</TableCell>
                <TableCell className="text-right tabular-nums">{row.sales}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.discountedSales}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({percent(row.discountedSales, row.sales)}%)
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatSoles(row.discountTotal)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.offlineDiscountedSales}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.pinFailures}</TableCell>
                <TableCell className="text-right tabular-nums">{row.pinResets}</TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    missingCash.get(row.cashierId) && "font-medium text-destructive",
                  )}
                >
                  {missingCash.get(row.cashierId)
                    ? formatSoles(missingCash.get(row.cashierId)!)
                    : "—"}
                </TableCell>
                <TableCell>
                  {reasons.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Todo normal</span>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {reasons.map((reason) => (
                        <Badge
                          key={reason}
                          variant="outline"
                          className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        >
                          <AlertTriangleIcon />
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </DataTable>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle
          title="Ventas con alertas"
          description="Ventas que el sistema aceptó (el cliente ya pagó) pero donde algo no cuadra. Pasa el cursor sobre cada alerta para ver qué significa."
        />
        <DataTable
          columns={[
            ID_COLUMN,
            { label: "Fecha" },
            { label: "Cajero" },
            { label: "Trabajador" },
            { label: "Descuento", className: "text-right" },
            { label: "Total", className: "text-right" },
            { label: "Alertas" },
          ]}
          isEmpty={flagged.length === 0}
          emptyMessage="Sin alertas en este periodo."
        >
          {flagged.map((sale) => (
            <TableRow key={sale.saleId}>
              <IdCell id={sale.saleId} />
              <TableCell className="text-muted-foreground tabular-nums">
                {dateTimeFormat.format(sale.clientCreatedAt)}
              </TableCell>
              <TableCell>{sale.cashierName}</TableCell>
              <TableCell className="text-sm">
                {sale.workerName ? (
                  <>
                    <div>{sale.workerName}</div>
                    <div className="text-xs text-muted-foreground">DNI {sale.workerDni}</div>
                  </>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {sale.discountTotal > 0 ? `−${formatSoles(sale.discountTotal)}` : "—"}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatSoles(sale.total)}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {sale.auditFlags
                    .filter((flag) => !INFO_AUDIT_FLAGS.includes(flag))
                    .map((flag) => (
                      <Badge key={flag} variant="destructive" title={AUDIT_FLAG_HELP[flag]}>
                        {AUDIT_FLAG_LABELS[flag]}
                      </Badge>
                    ))}
                  {sale.auditFlags.includes("OFFLINE_VERIFIED") && (
                    <Badge variant="outline" title={AUDIT_FLAG_HELP.OFFLINE_VERIFIED}>
                      {AUDIT_FLAG_LABELS.OFFLINE_VERIFIED}
                    </Badge>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle
          title="Registro de actividad"
          description="Claves incorrectas, cambios de clave, aprobaciones y cambios del descuento. No se puede borrar."
        />
        <DataTable
          columns={[
            ID_COLUMN,
            { label: "Fecha" },
            { label: "Qué pasó" },
            { label: "Trabajador" },
            { label: "Hecho por" },
          ]}
          isEmpty={events.length === 0}
          emptyMessage="Sin actividad en este periodo."
        >
          {events.map((event) => {
            const channel = EVENT_CHANNELS[String(event.payload.channel ?? "")];
            return (
              <TableRow key={event.id}>
                <IdCell id={event.id} />
                <TableCell className="text-muted-foreground tabular-nums">
                  {dateTimeFormat.format(event.occurredAt)}
                </TableCell>
                <TableCell className={cn("font-medium", EVENT_TONES[event.type])}>
                  {AUDIT_EVENT_LABELS[event.type] ?? event.type}
                  {channel && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      ({channel})
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {event.workerName ? (
                    <>
                      <div>{event.workerName}</div>
                      <div className="text-xs text-muted-foreground">DNI {event.workerDni}</div>
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>{event.actorName ?? "El propio trabajador"}</TableCell>
              </TableRow>
            );
          })}
        </DataTable>
      </section>
    </>
  );
}

function Metric({
  label,
  value,
  hint,
  warn = false,
}: {
  label: string;
  value: string;
  hint: string;
  warn?: boolean;
}) {
  return (
    <Card className={cn(warn && "border-amber-500/40")}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={cn("text-2xl font-semibold tabular-nums", warn && "text-amber-700 dark:text-amber-400")}>
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
    </Card>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-0.5">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default async function AdminAuditPage({
  searchParams,
}: PageProps<"/admin/audit">) {
  const today = storeDateKey(new Date());
  const { from, to } = parseDateRange(await searchParams, today);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Auditoría de descuentos"
        description="Controla que el descuento para trabajadores del aeropuerto se use bien."
        action={<AuditRangeFilter from={from} to={to} today={today} />}
      />
      <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3 text-sm">
        <InfoIcon className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden />
        <p className="text-muted-foreground">
          Cada descuento exige la <strong className="text-foreground">clave secreta del trabajador</strong>,
          que el cajero no conoce. Además, cada trabajador puede revisar sus compras
          en <Link href="/mis-puntos" className="font-medium text-foreground underline">Mis puntos</Link>:
          si ve una compra que no hizo, avisará. Aquí ves las señales que merecen
          revisión.
        </p>
      </div>
      <Suspense
        key={`${from}-${to}`}
        fallback={
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </>
        }
      >
        <AuditReport from={from} to={to} />
      </Suspense>
    </div>
  );
}

import { ArrowLeftIcon, CheckCircle2Icon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { listDiscrepanciesUseCase } from "@/application/use-cases/inventory/discrepancies";
import { DataTable, ID_COLUMN, IdCell } from "@/components/admin/data-table";
import { ResolveDiscrepancyDialog } from "@/components/admin/inventory/resolve-discrepancy-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { DISCREPANCY_STATUS_LABELS } from "@/domain/entities/receiving";
import { round2 } from "@/domain/value-objects/money";
import { STORE_TIME_ZONE } from "@/domain/value-objects/store-time";
import { receivingRepository } from "@/infrastructure/repositories";
import { formatSoles } from "@/lib/money";
import { cn } from "@/lib/utils";

const dateFormat = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeZone: STORE_TIME_ZONE,
});

const COLUMNS = [
  ID_COLUMN,
  { label: "Fecha" },
  { label: "Proveedor" },
  { label: "Producto" },
  { label: "Factura / Llegó", className: "text-right" },
  { label: "Diferencia", className: "text-right" },
  { label: "Monto", className: "text-right" },
  { label: "Estado" },
];

async function DiscrepanciesContent() {
  const gaps = await listDiscrepanciesUseCase(receivingRepository);
  const open = gaps.filter((g) => g.status === "open");
  const missingAmount = round2(
    open.filter((g) => g.units < 0).reduce((sum, g) => sum + g.amount, 0),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Diferencias con la factura"
        description={
          open.length === 0
            ? "Cuando algo llegue incompleto o de más, aparecerá aquí."
            : `${open.length} por resolver${missingAmount > 0 ? ` · ${formatSoles(missingAmount)} por reclamar a proveedores` : ""}.`
        }
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/admin/inventory" />}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Inventario
          </Button>
        }
      />
      {gaps.length === 0 ? (
        <EmptyState
          icon={CheckCircle2Icon}
          title="Todo llegó completo"
          description="Al ingresar mercadería, desmarca “Llegó completo” si falta o sobra algo. La diferencia quedará aquí para resolverla."
        />
      ) : (
        <DataTable columns={COLUMNS} isEmpty={false}>
          {gaps.map((gap) => (
            <TableRow key={gap.id} className={cn(gap.status !== "open" && "opacity-70")}>
              <IdCell id={gap.id} />
              <TableCell className="text-muted-foreground tabular-nums">
                {dateFormat.format(gap.receivedAt)}
                <div className="text-xs">Ingreso #{gap.receiptId}</div>
              </TableCell>
              <TableCell className="text-sm">
                {gap.supplierName ?? "—"}
                {gap.docNumber && (
                  <div className="font-mono text-xs text-muted-foreground">
                    {gap.docNumber}
                  </div>
                )}
              </TableCell>
              <TableCell className="font-medium">{gap.productName}</TableCell>
              <TableCell className="text-right tabular-nums">
                {gap.invoiceUnits} / {gap.receivedUnits}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-semibold tabular-nums",
                  gap.units < 0
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-sky-700 dark:text-sky-400",
                )}
              >
                {gap.units < 0 ? `Faltaron ${-gap.units}` : `Sobraron ${gap.units}`}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatSoles(gap.amount)}
              </TableCell>
              <TableCell>
                {gap.status === "open" ? (
                  <ResolveDiscrepancyDialog
                    id={gap.id}
                    productName={gap.productName}
                    units={gap.units}
                    tracksExpiry={gap.tracksExpiry}
                  />
                ) : (
                  <div className="text-sm">
                    <Badge variant="outline">
                      {DISCREPANCY_STATUS_LABELS[gap.status]}
                    </Badge>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {gap.resolvedByName}
                      {gap.resolvedAt && ` · ${dateFormat.format(gap.resolvedAt)}`}
                      {gap.resolutionNote && ` · ${gap.resolutionNote}`}
                    </div>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      )}
    </div>
  );
}

export default function DiscrepanciesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <DiscrepanciesContent />
    </Suspense>
  );
}

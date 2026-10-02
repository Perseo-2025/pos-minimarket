import { ArrowLeftIcon, ClipboardCheckIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { listCountItemsUseCase } from "@/application/use-cases/inventory/daily-count";
import { DataTable, ID_COLUMN, IdCell } from "@/components/admin/data-table";
import { ReviewCountDialog } from "@/components/admin/inventory/review-count-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { COUNT_ITEM_STATUS_LABELS } from "@/domain/entities/daily-count";
import { STORE_TIME_ZONE } from "@/domain/value-objects/store-time";
import { dailyCountRepository } from "@/infrastructure/repositories";
import { cn } from "@/lib/utils";

const dateTimeFormat = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: STORE_TIME_ZONE,
});

const COLUMNS = [
  ID_COLUMN,
  { label: "Fecha" },
  { label: "Producto" },
  { label: "Dónde" },
  { label: "Contó" },
  { label: "Sistema / Contado", className: "text-right" },
  { label: "Estado" },
];

const countButton = (
  <Button nativeButton={false} render={<Link href="/almacen/conteo" />}>
    <ClipboardCheckIcon data-icon="inline-start" />
    Hacer conteo del día
  </Button>
);

async function CountsContent() {
  const items = await listCountItemsUseCase(dailyCountRepository);
  const pending = items.filter((i) => i.status === "pending").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Conteos del día"
        description={
          pending === 0
            ? "Cada día se cuentan unos pocos productos. Lo que no coincide llega aquí para que lo revises."
            : `${pending} ${pending === 1 ? "conteo no coincide" : "conteos no coinciden"} con el sistema. Revisa antes de ajustar el stock.`
        }
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/admin/inventory" />}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              Inventario
            </Button>
            {countButton}
          </div>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardCheckIcon}
          title="Aún no hay conteos"
          description="Cada día el sistema sugiere unos pocos productos para contar. Así se revisa toda la tienda poco a poco, sin cerrar."
          action={countButton}
        />
      ) : (
        <DataTable columns={COLUMNS} isEmpty={false}>
          {items.map((item) => (
            <TableRow
              key={item.id}
              className={cn(item.status !== "pending" && "opacity-70")}
            >
              <IdCell id={item.id} />
              <TableCell className="text-muted-foreground tabular-nums">
                {dateTimeFormat.format(item.countedAt)}
              </TableCell>
              <TableCell className="font-medium">{item.productName}</TableCell>
              <TableCell>{item.locationName}</TableCell>
              <TableCell className="text-sm">{item.countedByName ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">
                {item.expected} / {item.counted}
                {item.counted !== item.expected && (
                  <div
                    className={cn(
                      "text-xs font-medium",
                      item.counted < item.expected
                        ? "text-destructive"
                        : "text-sky-700 dark:text-sky-400",
                    )}
                  >
                    {item.counted > item.expected ? "+" : ""}
                    {item.counted - item.expected}
                  </div>
                )}
              </TableCell>
              <TableCell>
                {item.status === "pending" ? (
                  <ReviewCountDialog
                    id={item.id}
                    productName={item.productName}
                    locationName={item.locationName}
                    countedByName={item.countedByName}
                    expected={item.expected}
                    counted={item.counted}
                  />
                ) : (
                  <div className="text-sm">
                    <Badge variant="outline">{COUNT_ITEM_STATUS_LABELS[item.status]}</Badge>
                    {(item.reviewedByName || item.reviewNote) && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {item.reviewedByName}
                        {item.reviewNote && ` · ${item.reviewNote}`}
                      </div>
                    )}
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

export default function CountsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <CountsContent />
    </Suspense>
  );
}

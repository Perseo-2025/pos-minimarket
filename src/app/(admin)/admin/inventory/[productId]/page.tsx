import { ArrowLeftIcon, ClipboardListIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getProductKardexUseCase } from "@/application/use-cases/inventory/get-inventory";
import { idSchema } from "@/application/validation/id";
import { DataTable, ID_COLUMN, IdCell } from "@/components/admin/data-table";
import { Quantity } from "@/components/admin/inventory/inventory-table";
import { LotList } from "@/components/admin/inventory/lot-list";
import { StockCountDialog } from "@/components/admin/inventory/stock-count-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { STOCK_MOVEMENT_LABELS } from "@/domain/entities/inventory";
import { STORE_TIME_ZONE } from "@/domain/value-objects/store-time";
import { inventoryRepository } from "@/infrastructure/repositories";
import { cn } from "@/lib/utils";

const dateTimeFormat = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: STORE_TIME_ZONE,
});

const COLUMNS = [
  ID_COLUMN,
  { label: "Fecha" },
  { label: "Movimiento" },
  { label: "Ubicación" },
  { label: "Cantidad", className: "text-right" },
  { label: "Saldo", className: "text-right" },
  { label: "Hecho por" },
  { label: "Detalle" },
];

async function KardexContent({ productId }: { productId: number }) {
  const kardex = await getProductKardexUseCase(inventoryRepository, productId);
  if (!kardex) notFound();

  const { locations, stock, movements, limit } = kardex;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={stock.productName}
        description={`Kardex · ${stock.categoryName}. Cada entrada y salida queda registrada y no se puede borrar.`}
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/admin/inventory" />}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              Inventario
            </Button>
            <StockCountDialog
              productId={stock.productId}
              productName={stock.productName}
              byLocation={stock.byLocation}
              locations={locations.map((l) => ({ id: l.id, name: l.name }))}
              tracksExpiry={stock.tracksExpiry}
              lots={stock.lots}
              trigger={
                <Button>
                  <ClipboardListIcon data-icon="inline-start" />
                  Contar
                </Button>
              }
            />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {locations.map((l) => (
          <Card key={l.id} size="sm">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {l.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                <Quantity value={stock.byLocation[l.id]} />
              </div>
              {stock.tracksExpiry && (
                <LotList
                  lots={stock.lots.filter((lot) => lot.locationId === l.id)}
                  warningDays={stock.expiryWarningDays}
                />
              )}
            </CardContent>
          </Card>
        ))}
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            <Quantity value={stock.trackStock ? stock.total : undefined} />
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-2">
        <DataTable
          columns={COLUMNS}
          isEmpty={movements.length === 0}
          emptyMessage="Sin movimientos. Registra un conteo para cargar el stock inicial."
        >
          {movements.map((m) => (
            <TableRow key={m.id}>
              <IdCell id={m.id} />
              <TableCell className="text-muted-foreground tabular-nums">
                {dateTimeFormat.format(m.occurredAt)}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{STOCK_MOVEMENT_LABELS[m.type]}</Badge>
              </TableCell>
              <TableCell>{m.locationName}</TableCell>
              <TableCell
                className={cn(
                  "text-right font-medium tabular-nums",
                  m.qtyDelta < 0 && "text-destructive",
                  m.qtyDelta > 0 && "text-emerald-700 dark:text-emerald-400",
                )}
              >
                {m.qtyDelta > 0 ? "+" : ""}
                {m.qtyDelta}
              </TableCell>
              <TableCell className="text-right">
                <Quantity value={m.balanceAfter} />
              </TableCell>
              <TableCell>{m.actorName ?? "—"}</TableCell>
              <TableCell className="max-w-64 text-sm text-muted-foreground">
                {m.saleId !== null ? (
                  <span className="font-mono text-xs">Ticket #{m.saleId}</span>
                ) : m.receiptId !== null ? (
                  <span className="text-xs">
                    Ingreso #{m.receiptId}
                    {m.note && ` · ${m.note}`}
                  </span>
                ) : m.transferId !== null ? (
                  <span className="text-xs">Traslado #{m.transferId}</span>
                ) : (
                  <span className="line-clamp-2">{m.note ?? "—"}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
        {movements.length === limit && (
          <p className="text-xs text-muted-foreground">
            Se muestran los últimos {limit} movimientos.
          </p>
        )}
      </section>
    </div>
  );
}

export default async function ProductKardexPage({
  params,
}: PageProps<"/admin/inventory/[productId]">) {
  const { productId } = await params;
  const id = idSchema.safeParse(productId);
  if (!id.success) notFound();

  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <KardexContent productId={id.data} />
    </Suspense>
  );
}

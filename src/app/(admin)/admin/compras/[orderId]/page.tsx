import { ArrowLeftIcon, PackagePlusIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPurchaseOrderUseCase } from "@/application/use-cases/purchasing/purchase-orders";
import { idSchema } from "@/application/validation/id";
import { DataTable } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { CancelOrderButton } from "@/components/admin/purchasing/cancel-order-button";
import { OrderStatusBadge } from "@/components/admin/purchasing/order-status-badge";
import { formatExpiry } from "@/components/expiry-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { STORE_TIME_ZONE } from "@/domain/value-objects/store-time";
import { purchaseOrderRepository } from "@/infrastructure/repositories";
import { formatSoles } from "@/lib/money";
import { cn } from "@/lib/utils";

const dateTimeFormat = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: STORE_TIME_ZONE,
});

const COLUMNS = [
  { label: "Producto" },
  { label: "Pediste" },
  { label: "Entregado", className: "text-right" },
  { label: "Falta", className: "text-right" },
  { label: "Costo aprox.", className: "text-right" },
];

async function OrderContent({ orderId }: { orderId: number }) {
  const order = await getPurchaseOrderUseCase(purchaseOrderRepository, orderId);
  if (!order) notFound();
  const open = order.status === "pending" || order.status === "partial";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Orden de compra #${order.id} · ${order.supplierName}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            Creada el {dateTimeFormat.format(order.createdAt)}
            {order.createdByName && ` por ${order.createdByName}`}
            {order.expectedAt && ` · llega el ${formatExpiry(order.expectedAt)}`}
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/admin/compras" />}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              Órdenes
            </Button>
            {open && (
              <>
                <Button
                  nativeButton={false}
                  render={
                    <Link href={`/admin/inventory/ingresos/nuevo?orden=${order.id}`} />
                  }
                >
                  <PackagePlusIcon data-icon="inline-start" />
                  Registrar lo que llegó
                </Button>
                <CancelOrderButton orderId={order.id} />
              </>
            )}
          </div>
        }
      />

      <DataTable columns={COLUMNS} isEmpty={order.lines.length === 0}>
        {order.lines.map((line) => {
          const missing = Math.max(0, line.units - line.receivedUnits);
          return (
            <TableRow key={line.productId}>
              <TableCell className="font-medium">{line.productName}</TableCell>
              <TableCell className="text-sm">
                {line.quantity} {line.presentationName ?? "und"}
                {line.presentationName && (
                  <span className="text-muted-foreground"> · {line.units} und</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{line.receivedUnits}</TableCell>
              <TableCell
                className={cn(
                  "text-right font-medium tabular-nums",
                  missing > 0 && order.status !== "cancelled" && "text-amber-700 dark:text-amber-400",
                )}
              >
                {missing === 0 ? "✓" : missing}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {line.estimatedTotal === null ? "—" : formatSoles(line.estimatedTotal)}
              </TableCell>
            </TableRow>
          );
        })}
      </DataTable>

      {order.note && (
        <p className="text-sm text-muted-foreground">Nota: {order.note}</p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-heading font-semibold">Ingresos de esta orden</h2>
        {order.receipts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no llegó nada de esta orden.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {order.receipts.map((receipt) => (
              <li key={receipt.id}>
                <Link href="/admin/inventory/ingresos" className="hover:underline">
                  Ingreso #{receipt.id}
                </Link>{" "}
                · {dateTimeFormat.format(receipt.receivedAt)}
                {receipt.docNumber && ` · ${receipt.docNumber}`}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default async function PurchaseOrderPage({
  params,
}: PageProps<"/admin/compras/[orderId]">) {
  const { orderId } = await params;
  const id = idSchema.safeParse(orderId);
  if (!id.success) notFound();

  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <OrderContent orderId={id.data} />
    </Suspense>
  );
}

import { ClipboardListIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { listPurchaseOrdersUseCase } from "@/application/use-cases/purchasing/purchase-orders";
import { DataTable, ID_COLUMN, IdCell } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { OrderStatusBadge } from "@/components/admin/purchasing/order-status-badge";
import { EmptyState } from "@/components/empty-state";
import { formatExpiry } from "@/components/expiry-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { STORE_TIME_ZONE } from "@/domain/value-objects/store-time";
import { purchaseOrderRepository } from "@/infrastructure/repositories";
import { formatSoles } from "@/lib/money";

const dateFormat = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeZone: STORE_TIME_ZONE,
});

const COLUMNS = [
  ID_COLUMN,
  { label: "Fecha" },
  { label: "Proveedor" },
  { label: "Productos" },
  { label: "Llega" },
  { label: "Costo aprox.", className: "text-right" },
  { label: "Estado" },
];

const newOrderButton = (
  <Button nativeButton={false} render={<Link href="/admin/compras/nueva" />}>
    <PlusIcon data-icon="inline-start" />
    Nueva orden de compra
  </Button>
);

async function OrdersContent() {
  const orders = await listPurchaseOrdersUseCase(purchaseOrderRepository);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Órdenes de compra"
        description="Lo que le pides a cada proveedor. Cuando llega, se ingresa al Almacén desde la misma orden."
        action={newOrderButton}
      />
      {orders.length === 0 ? (
        <EmptyState
          icon={ClipboardListIcon}
          title="Aún no hay órdenes de compra"
          description="Anota lo que le pides al proveedor (o lo que te tomó el vendedor en preventa). Al llegar, solo confirmas lo que vino."
          action={newOrderButton}
        />
      ) : (
        <DataTable columns={COLUMNS} isEmpty={false}>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <IdCell id={order.id} />
              <TableCell className="text-muted-foreground tabular-nums">
                {dateFormat.format(order.createdAt)}
              </TableCell>
              <TableCell>
                <Link
                  href={`/admin/compras/${order.id}`}
                  className="font-medium hover:underline"
                >
                  {order.supplierName}
                </Link>
              </TableCell>
              <TableCell className="max-w-80 text-sm">
                {order.lines
                  .map(
                    (line) =>
                      `${line.quantity} ${line.presentationName ?? "und"} ${line.productName}`,
                  )
                  .join(" · ")}
              </TableCell>
              <TableCell className="text-sm tabular-nums">
                {order.expectedAt ? formatExpiry(order.expectedAt) : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {order.estimatedTotal === null ? "—" : formatSoles(order.estimatedTotal)}
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={order.status} />
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      )}
    </div>
  );
}

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <OrdersContent />
    </Suspense>
  );
}

import { ArrowRightLeftIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { listTransfersUseCase } from "@/application/use-cases/inventory/transfer-stock";
import { DataTable, ID_COLUMN, IdCell } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { STORE_TIME_ZONE } from "@/domain/value-objects/store-time";
import { receivingRepository } from "@/infrastructure/repositories";

const dateTimeFormat = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: STORE_TIME_ZONE,
});

const COLUMNS = [
  ID_COLUMN,
  { label: "Fecha" },
  { label: "Recorrido" },
  { label: "Productos" },
  { label: "Registró" },
];

const newTransferButton = (
  <Button
    nativeButton={false}
    render={<Link href="/admin/inventory/traslados/nuevo" />}
  >
    <PlusIcon data-icon="inline-start" />
    Trasladar a Tienda
  </Button>
);

async function TransfersContent() {
  const transfers = await listTransfersUseCase(receivingRepository);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Traslados a la Tienda"
        description="Lo que pasó del Almacén a la Tienda y quedó listo para vender."
        action={newTransferButton}
      />
      {transfers.length === 0 ? (
        <EmptyState
          icon={ArrowRightLeftIcon}
          title="Aún no hay traslados"
          description="Cuando lleves mercadería del Almacén a la Tienda, quedará registrado aquí."
          action={newTransferButton}
        />
      ) : (
        <DataTable columns={COLUMNS} isEmpty={false}>
          {transfers.map((transfer) => (
            <TableRow key={transfer.id}>
              <IdCell id={transfer.id} />
              <TableCell className="text-muted-foreground tabular-nums">
                {dateTimeFormat.format(transfer.createdAt)}
              </TableCell>
              <TableCell className="text-sm">
                {transfer.fromName} → {transfer.toName}
              </TableCell>
              <TableCell className="max-w-96 text-sm">
                <ul className="flex flex-col gap-0.5">
                  {transfer.lines.map((line, index) => (
                    <li key={index}>
                      {line.units} und · {line.productName}
                    </li>
                  ))}
                </ul>
                {transfer.note && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {transfer.note}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {transfer.createdByName ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      )}
    </div>
  );
}

export default function TransfersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <TransfersContent />
    </Suspense>
  );
}

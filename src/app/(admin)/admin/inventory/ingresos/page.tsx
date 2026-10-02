import { PackagePlusIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { listReceiptsUseCase } from "@/application/use-cases/inventory/receive-goods";
import { DataTable, ID_COLUMN, IdCell } from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { RECEIPT_DOC_TYPE_LABELS } from "@/domain/entities/receiving";
import { STORE_TIME_ZONE } from "@/domain/value-objects/store-time";
import { receivingRepository } from "@/infrastructure/repositories";
import { formatSoles } from "@/lib/money";

const dateTimeFormat = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: STORE_TIME_ZONE,
});

const COLUMNS = [
  ID_COLUMN,
  { label: "Fecha" },
  { label: "Proveedor" },
  { label: "Documento" },
  { label: "Productos" },
  { label: "Total", className: "text-right" },
  { label: "Registró" },
];

const newReceiptButton = (
  <Button
    nativeButton={false}
    render={<Link href="/admin/inventory/ingresos/nuevo" />}
  >
    <PlusIcon data-icon="inline-start" />
    Ingresar mercadería
  </Button>
);

async function ReceiptsContent() {
  const receipts = await listReceiptsUseCase(receivingRepository);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ingresos al Almacén"
        description="Toda la mercadería que entró, con su documento."
        action={newReceiptButton}
      />
      {receipts.length === 0 ? (
        <EmptyState
          icon={PackagePlusIcon}
          title="Aún no ingresó mercadería"
          description="Cuando llegue un pedido del proveedor, regístralo aquí. Así el stock empieza en el Almacén."
          action={newReceiptButton}
        />
      ) : (
        <DataTable columns={COLUMNS} isEmpty={false}>
          {receipts.map((receipt) => (
            <TableRow key={receipt.id}>
              <IdCell id={receipt.id} />
              <TableCell className="text-muted-foreground tabular-nums">
                {dateTimeFormat.format(receipt.receivedAt)}
              </TableCell>
              <TableCell>{receipt.supplierName ?? "—"}</TableCell>
              <TableCell className="text-sm">
                {RECEIPT_DOC_TYPE_LABELS[receipt.docType]}
                {receipt.docNumber && (
                  <div className="font-mono text-xs text-muted-foreground">
                    {receipt.docNumber}
                  </div>
                )}
              </TableCell>
              <TableCell className="max-w-96 text-sm">
                <ul className="flex flex-col gap-0.5">
                  {receipt.lines.map((line, index) => (
                    <li key={index}>
                      {line.quantity} {line.presentationName ?? "und"}{" "}
                      {line.productName}
                      <span className="text-muted-foreground">
                        {" "}
                        · {line.units} und
                      </span>
                      {line.receivedUnits !== line.units && (
                        <Badge
                          variant="outline"
                          className="ml-1 text-amber-700 dark:text-amber-400"
                        >
                          {line.receivedUnits < line.units
                            ? `Faltaron ${line.units - line.receivedUnits}`
                            : `Sobraron ${line.receivedUnits - line.units}`}
                        </Badge>
                      )}
                      {line.isBonus && (
                        <Badge
                          variant="outline"
                          className="ml-1 text-emerald-700 dark:text-emerald-400"
                        >
                          Regalo
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatSoles(receipt.total)}
              </TableCell>
              <TableCell className="text-sm">
                {receipt.createdByName ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      )}
    </div>
  );
}

export default function ReceiptsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <ReceiptsContent />
    </Suspense>
  );
}

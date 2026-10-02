import { ArrowLeftIcon, WarehouseIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { loadTransferFormData } from "@/components/admin/inventory/form-data";
import { TransferForm } from "@/components/admin/inventory/transfer-form";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

async function NewTransferContent() {
  const available = await loadTransferFormData();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Trasladar a la Tienda"
        description="Lleva mercadería del Almacén a la Tienda. Desde ese momento aparece en caja para vender."
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/admin/inventory/traslados" />}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Historial de traslados
          </Button>
        }
      />
      {available.length === 0 ? (
        <EmptyState
          icon={WarehouseIcon}
          title="El Almacén está vacío"
          description="Primero ingresa mercadería al Almacén; luego podrás trasladarla a la Tienda."
          action={
            <Button
              nativeButton={false}
              render={<Link href="/admin/inventory/ingresos/nuevo" />}
            >
              Ingresar mercadería
            </Button>
          }
        />
      ) : (
        <TransferForm products={available} doneHref="/admin/inventory/traslados" />
      )}
    </div>
  );
}

export default function NewTransferPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <NewTransferContent />
    </Suspense>
  );
}

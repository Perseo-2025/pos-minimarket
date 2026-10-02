import { ArrowLeftIcon, WarehouseIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { loadTransferFormData } from "@/components/admin/inventory/form-data";
import { TransferForm } from "@/components/admin/inventory/transfer-form";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

async function TransferContent() {
  const products = await loadTransferFormData();
  return products.length === 0 ? (
    <EmptyState
      icon={WarehouseIcon}
      title="El Almacén está vacío"
      description="Primero ingresa la mercadería que llegó; luego podrás trasladarla a la Tienda."
      action={
        <Button nativeButton={false} render={<Link href="/almacen/ingreso" />}>
          Ingresar mercadería
        </Button>
      }
    />
  ) : (
    <TransferForm products={products} doneHref="/almacen" />
  );
}

export default function WarehouseTransferPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Volver al almacén"
          nativeButton={false}
          render={<Link href="/almacen" />}
        >
          <ArrowLeftIcon />
        </Button>
        <h1 className="font-heading text-xl font-semibold">Trasladar a Tienda</h1>
      </div>
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <TransferContent />
      </Suspense>
    </div>
  );
}

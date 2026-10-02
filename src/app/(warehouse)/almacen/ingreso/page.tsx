import { ArrowLeftIcon, PackageOpenIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { loadReceiptFormData } from "@/components/admin/inventory/form-data";
import { ReceiptForm } from "@/components/admin/inventory/receipt-form";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

async function ReceiptContent({ orderParam }: { orderParam: unknown }) {
  const data = await loadReceiptFormData();
  return data.products.length === 0 ? (
    <EmptyState
      icon={PackageOpenIcon}
      title="Aún no hay productos"
      description="Pide al administrador que registre los productos; luego podrás ingresar su mercadería."
    />
  ) : (
    <ReceiptForm
      {...data}
      initialOrderId={Number(orderParam) || undefined}
      doneHref="/almacen"
    />
  );
}

export default async function WarehouseReceiptPage({
  searchParams,
}: PageProps<"/almacen/ingreso">) {
  const { orden } = await searchParams;
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
        <h1 className="font-heading text-xl font-semibold">Ingresar mercadería</h1>
      </div>
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <ReceiptContent orderParam={orden} />
      </Suspense>
    </div>
  );
}

import { ArrowLeftIcon, TruckIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { loadReceiptFormData } from "@/components/admin/inventory/form-data";
import { PageHeader } from "@/components/admin/page-header";
import { PurchaseOrderForm } from "@/components/admin/purchasing/purchase-order-form";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

async function NewOrderContent() {
  const { products, presentations, suppliers } = await loadReceiptFormData();

  if (suppliers.length === 0 || products.length === 0) {
    return (
      <EmptyState
        icon={TruckIcon}
        title={
          suppliers.length === 0
            ? "Primero registra un proveedor"
            : "Primero registra tus productos"
        }
        description="Una orden de compra se hace a un proveedor y pide productos ya registrados."
        action={
          <Button
            nativeButton={false}
            render={
              <Link
                href={suppliers.length === 0 ? "/admin/suppliers" : "/admin/products"}
              />
            }
          >
            {suppliers.length === 0 ? "Ir a Proveedores" : "Ir a Productos"}
          </Button>
        }
      />
    );
  }
  return (
    <PurchaseOrderForm
      products={products}
      presentations={presentations}
      suppliers={suppliers}
    />
  );
}

export default function NewPurchaseOrderPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nueva orden de compra"
        description="Lo que le pides al proveedor. Cuando llegue, lo ingresas al Almacén desde esta orden."
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/admin/compras" />}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Órdenes de compra
          </Button>
        }
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <NewOrderContent />
      </Suspense>
    </div>
  );
}

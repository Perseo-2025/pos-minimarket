import { PlusIcon } from "lucide-react";
import { Suspense } from "react";
import { listActiveCategoriesUseCase } from "@/application/use-cases/categories/list-categories";
import { listSuppliersUseCase } from "@/application/use-cases/suppliers/save-supplier";
import { PageHeader } from "@/components/admin/page-header";
import { SupplierForm } from "@/components/admin/suppliers/supplier-form";
import { SupplierTable } from "@/components/admin/suppliers/supplier-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  categoryRepository,
  supplierRepository,
} from "@/infrastructure/repositories";

async function SuppliersContent() {
  const [suppliers, categories] = await Promise.all([
    listSuppliersUseCase(supplierRepository),
    listActiveCategoriesUseCase(categoryRepository),
  ]);
  const options = categories.map((c) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Proveedores"
        description="Empresas a las que compras y las categorías que te traen."
        action={
          <SupplierForm
            categories={options}
            trigger={
              <Button>
                <PlusIcon data-icon="inline-start" />
                Nuevo proveedor
              </Button>
            }
          />
        }
      />
      <SupplierTable suppliers={suppliers} categories={options} />
    </div>
  );
}

export default function AdminSuppliersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <SuppliersContent />
    </Suspense>
  );
}

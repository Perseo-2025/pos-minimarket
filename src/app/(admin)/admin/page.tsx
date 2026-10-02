import { TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { getSetupProgressUseCase } from "@/application/use-cases/dashboard/setup-progress";
import { getExpiringLotsUseCase } from "@/application/use-cases/inventory/get-inventory";
import { ExpiringLotsPanel } from "@/components/admin/inventory/expiring-lots-panel";
import { SetupSteps } from "@/components/admin/setup-steps";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  cashShiftRepository,
  categoryRepository,
  inventoryRepository,
  productRepository,
  supplierRepository,
} from "@/infrastructure/repositories";

async function SetupSection() {
  const progress = await getSetupProgressUseCase({
    categories: categoryRepository,
    suppliers: supplierRepository,
    products: productRepository,
    inventory: inventoryRepository,
  });
  return <SetupSteps progress={progress} />;
}

// Till shifts that need the admin: closed and not reviewed, or open too long.
async function CashSection() {
  const { closed, openLong } = await cashShiftRepository.countByStatus();
  if (closed === 0 && openLong === 0) return null;
  return (
    <Alert>
      <TriangleAlertIcon />
      <AlertTitle>
        {[
          closed > 0 && `${closed} ${closed === 1 ? "caja por revisar" : "cajas por revisar"}`,
          openLong > 0 &&
            `${openLong} ${openLong === 1 ? "caja abierta" : "cajas abiertas"} hace más de 12 horas`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </AlertTitle>
      <AlertDescription>
        <Link href="/admin/caja" className="underline">
          Ver cierres de caja
        </Link>
      </AlertDescription>
    </Alert>
  );
}

async function ExpiringSection() {
  const { lots, todayKey } = await getExpiringLotsUseCase(inventoryRepository);
  return <ExpiringLotsPanel lots={lots} todayKey={todayKey} limit={5} />;
}

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Gestiona productos, usuarios y revisa las ventas de la tienda.
        </p>
      </div>
      <Suspense fallback={null}>
        <CashSection />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <SetupSection />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
        <ExpiringSection />
      </Suspense>
    </div>
  );
}

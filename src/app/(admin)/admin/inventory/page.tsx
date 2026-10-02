import {
  ArrowRightLeftIcon,
  PackageOpenIcon,
  PackagePlusIcon,
  TriangleAlertIcon,
  WarehouseIcon,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { listCountItemsUseCase } from "@/application/use-cases/inventory/daily-count";
import { listDiscrepanciesUseCase } from "@/application/use-cases/inventory/discrepancies";
import {
  getExpiringLotsUseCase,
  getInventoryUseCase,
} from "@/application/use-cases/inventory/get-inventory";
import { ExpiringLotsPanel } from "@/components/admin/inventory/expiring-lots-panel";
import { InventoryTable } from "@/components/admin/inventory/inventory-table";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  dailyCountRepository,
  inventoryRepository,
  receivingRepository,
} from "@/infrastructure/repositories";

async function InventoryContent() {
  const [{ locations, stock }, expiring, gaps, counts] = await Promise.all([
    getInventoryUseCase(inventoryRepository),
    getExpiringLotsUseCase(inventoryRepository),
    listDiscrepanciesUseCase(receivingRepository),
    listCountItemsUseCase(dailyCountRepository),
  ]);
  const openGaps = gaps.filter((g) => g.status === "open").length;
  const pendingCounts = counts.filter((c) => c.status === "pending").length;

  const negative = stock.filter(
    (s) => s.trackStock && Object.values(s.byLocation).some((q) => q < 0),
  );
  const tracked = stock.filter((s) => s.trackStock).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventario"
        description={
          <>
            La mercadería entra al Almacén, pasa a la Tienda y desde ahí se
            vende.{" "}
            <Link href="/admin/inventory/ingresos" className="underline">
              Ingresos
            </Link>{" "}
            ·{" "}
            <Link href="/admin/inventory/traslados" className="underline">
              Traslados
            </Link>{" "}
            ·{" "}
            <Link href="/admin/inventory/diferencias" className="underline">
              Diferencias
            </Link>{" "}
            ·{" "}
            <Link href="/admin/inventory/conteos" className="underline">
              Conteos
            </Link>
          </>
        }
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              nativeButton={false}
              render={<Link href="/admin/inventory/ingresos/nuevo" />}
            >
              <PackagePlusIcon data-icon="inline-start" />
              Ingresar mercadería
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/admin/inventory/traslados/nuevo" />}
            >
              <ArrowRightLeftIcon data-icon="inline-start" />
              Trasladar a Tienda
            </Button>
          </div>
        }
      />

      {pendingCounts > 0 && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>
            {pendingCounts}{" "}
            {pendingCounts === 1 ? "conteo no coincide" : "conteos no coinciden"}{" "}
            con el sistema
          </AlertTitle>
          <AlertDescription>
            Revísalos antes de ajustar el stock.{" "}
            <Link href="/admin/inventory/conteos" className="underline">
              Revisar conteos
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {openGaps > 0 && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>
            {openGaps} {openGaps === 1 ? "diferencia" : "diferencias"} con la
            factura por resolver
          </AlertTitle>
          <AlertDescription>
            Llegó menos (o más) de lo que dice la factura.{" "}
            <Link href="/admin/inventory/diferencias" className="underline">
              Revisar diferencias
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {negative.length > 0 && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>
            {negative.length}{" "}
            {negative.length === 1 ? "producto vendido" : "productos vendidos"}{" "}
            sin stock
          </AlertTitle>
          <AlertDescription>
            {negative.map((s) => s.productName).join(", ")}. Suele indicar un
            traslado o una compra que no se registró. Cuenta el producto para
            corregirlo.
          </AlertDescription>
        </Alert>
      )}

      {stock.length === 0 ? (
        <EmptyState
          icon={PackageOpenIcon}
          title="Aún no hay productos"
          description="Registra tus productos y luego ingresa su mercadería al Almacén."
          action={
            <Button
              nativeButton={false}
              render={<Link href="/admin/products" />}
            >
              Ir a Productos
            </Button>
          }
        />
      ) : (
        <>
          {tracked === 0 && (
            <EmptyState
              icon={WarehouseIcon}
              title="Todavía no hay mercadería registrada"
              description="Registra el primer pedido que llegó con Ingresar mercadería. Después trasládalo a la Tienda para venderlo."
              className="py-8"
            />
          )}
          <ExpiringLotsPanel
            lots={expiring.lots}
            todayKey={expiring.todayKey}
          />
          <InventoryTable
            rows={stock}
            locations={locations.map((l) => ({ id: l.id, name: l.name }))}
          />
        </>
      )}
    </div>
  );
}

export default function AdminInventoryPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <InventoryContent />
    </Suspense>
  );
}

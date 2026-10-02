import {
  ArrowRightLeftIcon,
  ClipboardCheckIcon,
  PackagePlusIcon,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import {
  getExpiringLotsUseCase,
  getInventoryUseCase,
} from "@/application/use-cases/inventory/get-inventory";
import { ExpiringLotsPanel } from "@/components/admin/inventory/expiring-lots-panel";
import { WarehouseStockList } from "@/components/warehouse/warehouse-stock-list";
import { Skeleton } from "@/components/ui/skeleton";
import { inventoryRepository } from "@/infrastructure/repositories";

const ACTIONS = [
  {
    href: "/almacen/ingreso",
    title: "Ingresar mercadería",
    detail: "Llegó un pedido del proveedor",
    icon: PackagePlusIcon,
  },
  {
    href: "/almacen/traslado",
    title: "Trasladar a Tienda",
    detail: "Llevar productos para vender",
    icon: ArrowRightLeftIcon,
  },
  {
    href: "/almacen/conteo",
    title: "Conteo del día",
    detail: "Unos pocos productos para revisar hoy",
    icon: ClipboardCheckIcon,
  },
];

async function StockSection() {
  const [{ locations, stock }, expiring] = await Promise.all([
    getInventoryUseCase(inventoryRepository),
    getExpiringLotsUseCase(inventoryRepository),
  ]);
  return (
    <>
      <ExpiringLotsPanel
        lots={expiring.lots}
        todayKey={expiring.todayKey}
        forWarehouse
      />
      <WarehouseStockList
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        stock={stock
          .filter((s) => s.isActive)
          .map((s) => ({
            productId: s.productId,
            productName: s.productName,
            categoryName: s.categoryName,
            byLocation: s.byLocation,
          }))}
      />
    </>
  );
}

export default function WarehouseHomePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {ACTIONS.map(({ href, title, detail, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary hover:bg-primary/5"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Icon className="size-6" aria-hidden />
            </span>
            <span className="flex flex-col">
              <span className="font-heading text-lg font-semibold">{title}</span>
              <span className="text-sm text-muted-foreground">{detail}</span>
            </span>
          </Link>
        ))}
      </div>
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <StockSection />
      </Suspense>
    </div>
  );
}

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { getDailyCountUseCase } from "@/application/use-cases/inventory/daily-count";
import { listAllProductsUseCase } from "@/application/use-cases/products/list-products";
import { listPresentationsUseCase } from "@/application/use-cases/products/save-presentation";
import { DailyCountForm } from "@/components/warehouse/daily-count-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  dailyCountRepository,
  inventoryRepository,
  presentationRepository,
  productRepository,
} from "@/infrastructure/repositories";
import { cn } from "@/lib/utils";

async function CountContent({ locationParam }: { locationParam: unknown }) {
  const locations = await inventoryRepository.listLocations();
  // The shop floor by default: that's where things sell and go missing.
  const location =
    locations.find((l) => l.id === Number(locationParam)) ??
    locations.find((l) => l.kind === "store") ??
    locations[0];
  const [products, catalog, presentations] = await Promise.all([
    getDailyCountUseCase(dailyCountRepository, location.id),
    listAllProductsUseCase(productRepository),
    listPresentationsUseCase(presentationRepository),
  ]);
  // Only the codes of what is counted today.
  const today = new Set(products.map((p) => p.productId));
  const codes = [
    ...catalog.flatMap((p) =>
      today.has(p.id) && p.barcode ? [{ barcode: p.barcode, productId: p.id, units: 1 }] : [],
    ),
    ...presentations.flatMap((p) =>
      today.has(p.productId) && p.isActive && p.barcode
        ? [{ barcode: p.barcode, productId: p.productId, units: p.unitsTotal }]
        : [],
    ),
  ];

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Dónde cuentas" className="flex gap-2">
        {locations.map((l) => (
          <Link
            key={l.id}
            href={`/almacen/conteo?ubicacion=${l.id}`}
            className={cn(
              "rounded-lg border px-4 py-2 text-sm font-medium",
              l.id === location.id
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            {l.name}
          </Link>
        ))}
      </nav>
      <DailyCountForm
        // Remount when switching location: fresh entries.
        key={location.id}
        locationId={location.id}
        locationName={location.name}
        products={products}
        codes={codes}
      />
    </div>
  );
}

export default async function DailyCountPage({
  searchParams,
}: PageProps<"/almacen/conteo">) {
  const { ubicacion } = await searchParams;
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
        <h1 className="font-heading text-xl font-semibold">Conteo del día</h1>
      </div>
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <CountContent locationParam={ubicacion} />
      </Suspense>
    </div>
  );
}

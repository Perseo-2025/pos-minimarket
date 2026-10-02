import { Suspense } from "react";
import { listSalesByDateRangeUseCase } from "@/application/use-cases/sales/list-sales";
import { PageHeader } from "@/components/admin/page-header";
import { SalesDateFilter } from "@/components/admin/sales/sales-date-filter";
import { SalesSummary } from "@/components/admin/sales/sales-summary";
import {
  type SaleRow,
  SalesTable,
} from "@/components/admin/sales/sales-table";
import { Skeleton } from "@/components/ui/skeleton";
import { saleRepository } from "@/infrastructure/repositories";

// The store operates in Peru (UTC-5, no DST). Day boundaries are computed in
// that zone explicitly so the report doesn't shift if the server runs in UTC.
const STORE_TIME_ZONE = "America/Lima";
const STORE_UTC_OFFSET = "-05:00";

function todayInStore() {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TIME_ZONE }).format(
    new Date(),
  );
}

function parseDate(value: unknown, today: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return today;
  }
  if (Number.isNaN(new Date(`${value}T00:00:00${STORE_UTC_OFFSET}`).getTime())) {
    return today;
  }
  return value > today ? today : value;
}

async function SalesReport({ date }: { date: string }) {
  const sales = await listSalesByDateRangeUseCase(
    saleRepository,
    new Date(`${date}T00:00:00.000${STORE_UTC_OFFSET}`),
    new Date(`${date}T23:59:59.999${STORE_UTC_OFFSET}`),
  );

  const rows: SaleRow[] = sales.map((sale) => ({
    id: sale.id,
    createdAt: sale.clientCreatedAt.toISOString(),
    cashierName: sale.cashierName ?? "—",
    paymentType: sale.paymentType,
    subtotal: sale.subtotal,
    discountTotal: sale.discountTotal,
    giftTotal: sale.giftTotal,
    courtesyApprovedByName: sale.courtesyApprovedByName,
    total: sale.total,
    workerName: sale.workerName,
    workerDni: sale.workerDni,
    workerVerification: sale.workerVerification,
    pointsEarned: sale.pointsEarned,
    auditFlags: sale.auditFlags,
    units: sale.items.reduce((sum, item) => sum + item.quantity, 0),
    items: sale.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
      discountUnitAmount: item.discountUnitAmount ?? 0,
      discountAmount: item.discountAmount ?? 0,
      isGift: item.isGift ?? false,
      captureSource: item.captureSource ?? null,
    })),
  }));

  return (
    <>
      <SalesSummary sales={rows} />
      <SalesTable sales={rows} />
    </>
  );
}

function SalesReportSkeleton() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </>
  );
}

export default async function AdminSalesPage({
  searchParams,
}: PageProps<"/admin/sales">) {
  const today = todayInStore();
  const date = parseDate((await searchParams).date, today);

  const label = new Intl.DateTimeFormat("es-PE", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ventas"
        description={date === today ? `Hoy, ${label}` : label}
        action={<SalesDateFilter date={date} today={today} />}
      />
      {/* Keyed by date so the skeleton shows again when switching days. */}
      <Suspense key={date} fallback={<SalesReportSkeleton />}>
        <SalesReport date={date} />
      </Suspense>
    </div>
  );
}

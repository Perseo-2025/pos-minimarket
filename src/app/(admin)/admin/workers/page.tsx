import { Suspense } from "react";
import { getDiscountPolicyOverviewUseCase } from "@/application/use-cases/discount/discount-policy";
import { listWorkersUseCase } from "@/application/use-cases/workers/manage-workers";
import { PageHeader } from "@/components/admin/page-header";
import {
  DiscountPolicyCard,
  type PolicyView,
} from "@/components/admin/workers/discount-policy-card";
import { WorkerStatusTabs } from "@/components/admin/workers/worker-status-tabs";
import { WorkerTable } from "@/components/admin/workers/worker-table";
import { Skeleton } from "@/components/ui/skeleton";
import type { DiscountPolicy } from "@/domain/entities/discount-policy";
import type { WorkerStatus } from "@/domain/entities/worker";
import {
  discountPolicyRepository,
  workerRepository,
} from "@/infrastructure/repositories";

const STATUSES: WorkerStatus[] = ["pending", "active", "suspended", "rejected"];

const EMPTY_MESSAGES: Record<WorkerStatus, string> = {
  pending: "No hay trabajadores por aprobar. Los registros que hagan los cajeros aparecerán aquí.",
  active: "Aún no hay trabajadores activos.",
  suspended: "No hay trabajadores suspendidos.",
  rejected: "No hay registros rechazados.",
};

function toPolicyView(policy: DiscountPolicy): PolicyView {
  return {
    discountPercent: policy.discountPercent,
    maxDiscountedSalesPerDay: policy.maxDiscountedSalesPerDay,
    maxDiscountPerMonth: policy.maxDiscountPerMonth,
    pointsPerSol: policy.pointsPerSol,
    createdAt: policy.createdAt.toISOString(),
    createdByName: policy.createdByName ?? null,
  };
}

const HOW_IT_WORKS = [
  {
    title: "1. El cajero registra",
    body: "Con el DNI del trabajador. El trabajador crea su propia clave de 6 números.",
  },
  {
    title: "2. Tú apruebas",
    body: "Revisa los datos en «Por aprobar». Sin tu aprobación no hay descuento.",
  },
  {
    title: "3. Descuento en caja",
    body: "En cada compra el trabajador digita su clave. El cajero nunca la conoce.",
  },
];

async function WorkersContent({ statusParam }: { statusParam: unknown }) {
  const [counts, policies] = await Promise.all([
    workerRepository.countByStatus(),
    getDiscountPolicyOverviewUseCase(discountPolicyRepository),
  ]);

  const status: WorkerStatus = STATUSES.includes(statusParam as WorkerStatus)
    ? (statusParam as WorkerStatus)
    : counts.pending > 0
      ? "pending"
      : "active";
  const { workers } = await listWorkersUseCase(workerRepository, status);

  return (
    <>
      <DiscountPolicyCard
        active={policies.active && toPolicyView(policies.active)}
        versions={policies.versions.map(toPolicyView)}
      />
      <WorkerStatusTabs current={status} counts={counts} />
      <WorkerTable
        key={status}
        emptyMessage={EMPTY_MESSAGES[status]}
        workers={workers.map((w) => ({
          id: w.id,
          dni: w.dni,
          fullName: w.fullName,
          nameSource: w.nameSource,
          company: w.company,
          status: w.status,
          pendingReason: w.pendingReason,
          pointsBalance: w.pointsBalance,
          registeredByName: w.registeredByName ?? null,
          createdAt: w.createdAt.toISOString(),
        }))}
      />
    </>
  );
}

export default async function AdminWorkersPage({
  searchParams,
}: PageProps<"/admin/workers">) {
  const { status } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Trabajadores del Aeropuerto"
        description="Personas con descuento por trabajar en el aeropuerto. No son cajeros: son clientes con beneficio."
      />
      <ol className="grid gap-3 md:grid-cols-3">
        {HOW_IT_WORKS.map((step) => (
          <li key={step.title} className="rounded-xl border bg-muted/30 p-3 text-sm">
            <p className="font-semibold">{step.title}</p>
            <p className="text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
      <Suspense
        fallback={
          <>
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </>
        }
      >
        <WorkersContent statusParam={status} />
      </Suspense>
    </div>
  );
}

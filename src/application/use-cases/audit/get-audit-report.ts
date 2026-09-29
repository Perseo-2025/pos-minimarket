import type { AuditRepository } from "@/domain/repositories/audit-repository";

export async function getAuditReportUseCase(repo: AuditRepository, from: Date, to: Date) {
  const [cashiers, flagged, events] = await Promise.all([
    repo.cashierSummary(from, to),
    repo.flaggedSales(from, to),
    repo.listEvents({ from, to, limit: 200 }),
  ]);
  return { cashiers, flagged, events };
}

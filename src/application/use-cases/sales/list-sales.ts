import type { SaleRepository } from "@/domain/repositories/sale-repository";

export async function listSalesByDateRangeUseCase(
  repo: SaleRepository,
  from: Date,
  to: Date,
) {
  return repo.findByDateRange(from, to);
}

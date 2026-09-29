import type { SaleRepository } from "@/domain/repositories/sale-repository";
import { saleCreateSchema } from "@/application/validation/sale";

export async function createSaleUseCase(
  repo: SaleRepository,
  input: unknown,
  cashierId: string,
) {
  const data = saleCreateSchema.parse(input);
  return repo.insertWithItems(data, cashierId);
}

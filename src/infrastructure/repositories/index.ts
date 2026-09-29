import { DrizzleAuditRepository } from "./drizzle-audit-repository";
import { DrizzleCategoryRepository } from "./drizzle-category-repository";
import { DrizzleDiscountPolicyRepository } from "./drizzle-discount-policy-repository";
import { DrizzleProductRepository } from "./drizzle-product-repository";
import { DrizzleSaleRepository } from "./drizzle-sale-repository";
import { DrizzleUserRepository } from "./drizzle-user-repository";
import { DrizzleWorkerRepository } from "./drizzle-worker-repository";

export const auditRepository = new DrizzleAuditRepository();
export const categoryRepository = new DrizzleCategoryRepository();
export const discountPolicyRepository = new DrizzleDiscountPolicyRepository();
export const productRepository = new DrizzleProductRepository();
export const saleRepository = new DrizzleSaleRepository();
export const userRepository = new DrizzleUserRepository();
export const workerRepository = new DrizzleWorkerRepository();

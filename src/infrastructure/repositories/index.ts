import { DrizzleProductRepository } from "./drizzle-product-repository";
import { DrizzleSaleRepository } from "./drizzle-sale-repository";
import { DrizzleUserRepository } from "./drizzle-user-repository";

export const productRepository = new DrizzleProductRepository();
export const saleRepository = new DrizzleSaleRepository();
export const userRepository = new DrizzleUserRepository();

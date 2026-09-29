export type CartItem = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  // Captured when added: what an identified worker gets off this product.
  workerDiscountPercent: number;
  // Given away; needs an admin's approval before checkout.
  isCourtesy: boolean;
};

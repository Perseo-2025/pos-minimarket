import type { CaptureSource } from "@/domain/value-objects/capture-source";

export type CartItem = {
  productId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  // Captured when added: what an identified worker gets off this product.
  workerDiscountPercent: number;
  // Given away; needs an admin's approval before checkout.
  isCourtesy: boolean;
  // Scanned with the reader, or picked on screen (any tap makes it manual).
  captureSource: CaptureSource;
};

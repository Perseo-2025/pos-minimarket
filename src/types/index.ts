import type { CaptureSource } from "@/domain/value-objects/capture-source";

export type CartItem = {
  productId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  // Captured when added: soles an identified worker gets off each unit.
  workerDiscountAmount: number;
  // One unit is the worker's birthday gift.
  isGift: boolean;
  // Scanned with the reader, or picked on screen (any tap makes it manual).
  captureSource: CaptureSource;
};

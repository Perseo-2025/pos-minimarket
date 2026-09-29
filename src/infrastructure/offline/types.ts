import type { PaymentType } from "@/domain/entities/sale";

export type PendingSale = {
  id: string;
  paymentType: PaymentType;
  items: {
    id: string;
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
  total: number;
  clientCreatedAt: string;
  status: "pending" | "syncing" | "error";
  errorMessage?: string;
};

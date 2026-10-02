"use client";

import { useMemo, useState } from "react";
import type { CartItem } from "@/types";
import {
  type CaptureSource,
  mergeCaptureSources,
} from "@/domain/value-objects/capture-source";
import { round2 } from "@/domain/value-objects/money";

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  function addItem(product: {
    id: number;
    name: string;
    priceSale: number;
    workerDiscountPercent: number;
  }, source: CaptureSource = "manual") {
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                captureSource: mergeCaptureSources([item.captureSource, source]) ?? source,
              }
            : item,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.priceSale,
          quantity: 1,
          workerDiscountPercent: product.workerDiscountPercent,
          isCourtesy: false,
          captureSource: source,
        },
      ];
    });
  }

  function setQuantity(productId: number, quantity: number) {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity } : item,
      ),
    );
  }

  function setCourtesy(productId: number, isCourtesy: boolean) {
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, isCourtesy } : item,
      ),
    );
  }

  function removeItem(productId: number) {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  }

  function clear() {
    setItems([]);
  }

  const total = useMemo(
    () =>
      round2(
        items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
      ),
    [items],
  );

  return { items, addItem, setQuantity, setCourtesy, removeItem, clear, total };
}

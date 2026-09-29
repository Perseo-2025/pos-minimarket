"use client";

import { Card } from "@/components/ui/card";
import { formatSoles } from "@/lib/money";
import { ProductImagePlaceholder } from "./product-image-placeholder";

type Product = {
  id: string;
  name: string;
  category: string;
  priceSale: number;
  imageUrl?: string | null;
};

export function ProductGrid({
  products,
  onSelect,
}: {
  products: Product[];
  onSelect: (product: Product) => void;
}) {
  if (products.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No se encontraron productos.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {products.map((product) => (
        <Card
          key={product.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(product)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onSelect(product);
          }}
          className="cursor-pointer select-none gap-2 overflow-hidden p-2 active:scale-95 transition-transform"
        >
          <ProductImagePlaceholder src={product.imageUrl} alt={product.name} />
          <div className="px-1 pb-1">
            <p className="font-medium leading-tight">{product.name}</p>
            <p className="mt-1 font-semibold text-brand-blue">
              {formatSoles(product.priceSale)}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}

"use client";

import { ShoppingCartIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PRODUCT_CATEGORY_LABELS } from "@/domain/entities/product";
import type { PaymentType } from "@/domain/entities/sale";
import { round2 } from "@/domain/value-objects/money";
import { useCart } from "@/hooks/use-cart";
import { enqueueSale } from "@/infrastructure/offline/queue";
import { runSync } from "@/infrastructure/offline/sync-engine";
import type { PendingSale } from "@/infrastructure/offline/types";
import { formatSoles } from "@/lib/money";
import { CartPanel } from "./cart-panel";
import { type SidebarCategory, CategorySidebar } from "./category-sidebar";
import { CheckoutDialog } from "./checkout-dialog";
import { OfflineIndicator } from "./offline-indicator";
import { ProductGrid } from "./product-grid";
import { SearchBar } from "./search-bar";

type Product = {
  id: string;
  name: string;
  category: string;
  priceSale: number;
  imageUrl?: string | null;
};

function labelFor(category: string) {
  return (
    PRODUCT_CATEGORY_LABELS[category as keyof typeof PRODUCT_CATEGORY_LABELS] ??
    category.charAt(0).toUpperCase() + category.slice(1)
  );
}

export function PosScreen({ products }: { products: Product[] }) {
  const cart = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Derived from the actual catalog, not hardcoded — new categories added
  // from the admin panel show up here automatically.
  const categories: SidebarCategory[] = useMemo(() => {
    const seen = new Set<string>();
    const result: SidebarCategory[] = [];
    for (const product of products) {
      if (seen.has(product.category)) continue;
      seen.add(product.category);
      result.push({ value: product.category, label: labelFor(product.category) });
    }
    return result;
  }, [products]);

  const [selectedCategory, setSelectedCategory] = useState(
    () => categories[0]?.value ?? "",
  );

  const query = search.trim().toLowerCase();
  const visibleProducts =
    query.length > 0
      ? products.filter((p) => p.name.toLowerCase().includes(query))
      : products.filter((p) => p.category === selectedCategory);

  async function handleConfirm(paymentType: PaymentType) {
    const sale: PendingSale = {
      id: crypto.randomUUID(),
      paymentType,
      items: cart.items.map((item) => ({
        id: crypto.randomUUID(),
        productId: item.productId,
        productName: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: round2(item.unitPrice * item.quantity),
      })),
      total: cart.total,
      clientCreatedAt: new Date().toISOString(),
      status: "pending",
    };

    // Always local-first: the checkout never waits on the network.
    await enqueueSale(sale);
    void runSync();

    cart.clear();
    setCheckoutOpen(false);
    toast.success("Venta registrada");
  }

  function increaseQty(id: string) {
    cart.setQuantity(
      id,
      (cart.items.find((i) => i.productId === id)?.quantity ?? 0) + 1,
    );
  }

  function decreaseQty(id: string) {
    cart.setQuantity(
      id,
      (cart.items.find((i) => i.productId === id)?.quantity ?? 0) - 1,
    );
  }

  return (
    <div className="flex h-[calc(100vh-57px)]">
      <CategorySidebar
        categories={categories}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-center gap-3 border-b p-3">
          <SearchBar value={search} onChange={setSearch} />
          <div className="absolute right-4">
            <OfflineIndicator />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
          <ProductGrid products={visibleProducts} onSelect={cart.addItem} />
        </div>
        {cart.items.length > 0 && (
          <Button
            size="lg"
            onClick={() => setMobileCartOpen(true)}
            className="fixed right-4 bottom-4 gap-2 shadow-lg md:hidden"
          >
            <ShoppingCartIcon className="size-4" />
            {cart.items.length} · {formatSoles(cart.total)}
          </Button>
        )}
      </div>
      <div className="hidden w-80 shrink-0 border-l p-4 md:block">
        <CartPanel
          items={cart.items}
          total={cart.total}
          onIncrease={increaseQty}
          onDecrease={decreaseQty}
          onRemove={cart.removeItem}
          onCheckout={() => setCheckoutOpen(true)}
        />
      </div>
      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="bottom" className="h-[80vh]">
          <SheetHeader>
            <SheetTitle>Cesta</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden px-4 pb-4">
            <CartPanel
              items={cart.items}
              total={cart.total}
              onIncrease={increaseQty}
              onDecrease={decreaseQty}
              onRemove={cart.removeItem}
              onCheckout={() => {
                setMobileCartOpen(false);
                setCheckoutOpen(true);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
      <CheckoutDialog
        open={checkoutOpen}
        total={cart.total}
        onOpenChange={setCheckoutOpen}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

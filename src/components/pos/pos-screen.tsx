"use client";

import { ShoppingBasketIcon, ShoppingCartIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PAYMENT_TYPE_LABELS, type PaymentType } from "@/domain/entities/sale";
import {
  buildWorkerDiscountRule,
  lineTotal,
  priceSale,
} from "@/domain/services/sale-pricing";
import { useCart } from "@/hooks/use-cart";
import { enqueueSale } from "@/infrastructure/offline/queue";
import { runSync } from "@/infrastructure/offline/sync-engine";
import type { CachedPolicy, PendingSale } from "@/infrastructure/offline/types";
import {
  getWorkerSnapshot,
  refreshWorkerSnapshot,
} from "@/infrastructure/offline/worker-cache";
import { formatSoles } from "@/lib/money";
import { CartPanel } from "./cart-panel";
import { type SidebarCategory, CategorySidebar } from "./category-sidebar";
import { CheckoutDialog } from "./checkout-dialog";
import {
  type CourtesyApproval,
  type CourtesyLine,
  CourtesyDialog,
} from "./courtesy-dialog";
import { OfflineIndicator } from "./offline-indicator";
import { ProductGrid } from "./product-grid";
import { SearchBar } from "./search-bar";
import { type AppliedWorker, WorkerDiscountDialog } from "./worker-discount-dialog";

// A worker's PIN check is valid for one sale and a short time only: it can't
// be reused for the next customers in the queue.
const WORKER_VERIFICATION_TTL_MS = 10 * 60 * 1000;

type Product = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  priceSale: number;
  workerDiscountPercent: number;
  imageUrl?: string | null;
};

export function PosScreen({
  products,
  cashierId,
}: {
  products: Product[];
  cashierId: string;
}) {
  const cart = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [workerDialogOpen, setWorkerDialogOpen] = useState(false);
  const [worker, setWorker] = useState<{
    applied: AppliedWorker;
    policy: CachedPolicy;
  } | null>(null);
  const [courtesyApproval, setCourtesyApproval] = useState<CourtesyApproval | null>(
    null,
  );
  // Courtesy lines the admin is being asked to approve (null = dialog closed),
  // and the product that becomes free once they do.
  const [courtesyRequest, setCourtesyRequest] = useState<{
    saleId: string;
    lines: CourtesyLine[];
    addProductId: string | null;
  } | null>(null);
  // The sale id exists before checkout: a courtesy approval is signed for it.
  const saleIdRef = useRef<string | null>(null);
  function currentSaleId() {
    saleIdRef.current ??= crypto.randomUUID();
    return saleIdRef.current;
  }

  // Download the worker list + discount rule so the discount also works
  // without internet.
  useEffect(() => {
    void refreshWorkerSnapshot({ force: true });
  }, []);

  const discount = worker
    ? buildWorkerDiscountRule(worker.policy, worker.applied.usage)
    : null;
  const pricing = priceSale(cart.items, discount?.rule ?? null);

  let workerNotice: string | null = null;
  if (worker && discount) {
    if (discount.limitReached === "daily") {
      workerNotice = `Ya usó sus ${worker.policy.maxDiscountedSalesPerDay} compras con descuento de hoy. Esta compra va sin descuento, pero suma puntos.`;
    } else if (discount.limitReached === "monthly") {
      workerNotice = `Llegó al tope de descuento del mes (${formatSoles(worker.policy.maxDiscountPerMonth)}). Esta compra va sin descuento, pero suma puntos.`;
    } else if (pricing.capped) {
      workerNotice = `Solo le quedaban ${formatSoles(discount.remainingThisMonth)} de descuento este mes.`;
    }
  }

  // The approval is signed for an exact amount: if the courtesy lines change
  // afterwards (quantity, another product), the admin must approve again.
  const courtesyNeedsApproval =
    pricing.courtesyTotal > 0 &&
    (courtesyApproval === null || courtesyApproval.amount !== pricing.courtesyTotal);

  function courtesyLines(extraProductId: string | null): CourtesyLine[] {
    return cart.items
      .filter((item) => item.isCourtesy || item.productId === extraProductId)
      .map((item) => ({
        productId: item.productId,
        productName: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      }));
  }

  function toggleCourtesy(productId: string) {
    const item = cart.items.find((i) => i.productId === productId);
    if (!item) return;
    if (item.isCourtesy) {
      cart.setCourtesy(productId, false);
      return;
    }
    setMobileCartOpen(false);
    setCourtesyRequest({
      saleId: currentSaleId(),
      lines: courtesyLines(productId),
      addProductId: productId,
    });
  }

  function handleCourtesyApproved(approval: CourtesyApproval) {
    if (courtesyRequest?.addProductId) {
      cart.setCourtesy(courtesyRequest.addProductId, true);
    }
    setCourtesyApproval(approval);
    toast.success(`Cortesía aprobada por ${approval.adminName}`);
  }

  async function applyWorker(applied: AppliedWorker) {
    const snapshot = await getWorkerSnapshot();
    if (!snapshot?.policy) {
      toast.error("El descuento no está configurado");
      return;
    }
    setWorker({ applied, policy: snapshot.policy });
    toast.success(`Descuento aplicado a ${applied.fullName}`, {
      description:
        applied.verification === "pin_offline"
          ? "Clave verificada sin internet."
          : "Clave verificada.",
    });
  }

  function startCheckout() {
    if (
      worker &&
      Date.now() - worker.applied.verifiedAt > WORKER_VERIFICATION_TTL_MS
    ) {
      setWorker(null);
      toast.warning("La verificación del trabajador venció", {
        description: "Vuelve a pedirle su DNI y clave para aplicar el descuento.",
      });
      return false;
    }
    setCheckoutOpen(true);
    return true;
  }

  // Derived from the sellable catalog: products arrive ordered by the
  // category order set in the admin panel, and categories with no active
  // products are left out of the sidebar.
  const categories: SidebarCategory[] = useMemo(() => {
    const seen = new Set<string>();
    const result: SidebarCategory[] = [];
    for (const product of products) {
      if (seen.has(product.categoryId)) continue;
      seen.add(product.categoryId);
      result.push({
        value: product.categoryId,
        label: product.categoryName,
        icon: product.categoryIcon,
      });
    }
    return result;
  }, [products]);

  const [chosenCategory, setSelectedCategory] = useState(
    () => categories[0]?.value ?? "",
  );
  // If the chosen category disappears after a catalog refresh (deactivated
  // in the admin panel), fall back to the first one instead of a blank grid.
  const selectedCategory = categories.some((c) => c.value === chosenCategory)
    ? chosenCategory
    : (categories[0]?.value ?? "");

  const query = search.trim().toLowerCase();
  const visibleProducts =
    query.length > 0
      ? products.filter((p) => p.name.toLowerCase().includes(query))
      : products.filter((p) => p.categoryId === selectedCategory);

  async function handleConfirm() {
    if (courtesyNeedsApproval) return;
    const sale: PendingSale = {
      id: currentSaleId(),
      cashierId,
      paymentType,
      items: cart.items.map((item, index) => ({
        id: crypto.randomUUID(),
        productId: item.productId,
        productName: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: lineTotal(item),
        discountPercent: pricing.lines[index].discountPercent,
        discountAmount: pricing.lines[index].discountAmount,
        isCourtesy: item.isCourtesy,
      })),
      ...(pricing.courtesyTotal > 0 &&
        courtesyApproval && { courtesyToken: courtesyApproval.token }),
      subtotal: pricing.subtotal,
      discountTotal: pricing.discountTotal,
      total: pricing.total,
      clientCreatedAt: new Date().toISOString(),
      ...(worker && {
        workerId: worker.applied.id,
        workerVerification: worker.applied.verification,
        verificationToken: worker.applied.token,
        policyId: worker.policy.id,
      }),
      status: "pending",
    };
    const workerName = worker?.applied.fullName;
    const points = pricing.pointsEarned;

    // Always local-first: the checkout never waits on the network.
    await enqueueSale(sale);
    void runSync();

    cart.clear();
    setCheckoutOpen(false);
    // The worker and any courtesy belong to this sale only: the next
    // customer starts clean, with a new sale id.
    setWorker(null);
    setCourtesyApproval(null);
    saleIdRef.current = null;
    // Most sales are cash — start the next one from there.
    setPaymentType("cash");
    toast.success(`Venta registrada · ${PAYMENT_TYPE_LABELS[paymentType]}`, {
      description: workerName
        ? `${workerName}${points > 0 ? ` ganó ${points} puntos` : ""}`
        : undefined,
    });
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
          <ProductGrid
            products={visibleProducts}
            onSelect={cart.addItem}
            showWorkerDiscount={worker !== null}
          />
        </div>
        {cart.items.length > 0 && (
          <Button
            size="lg"
            onClick={() => setMobileCartOpen(true)}
            className="fixed right-4 bottom-4 gap-2 shadow-lg md:hidden"
          >
            <ShoppingCartIcon className="size-4" />
            {cart.items.length} · {formatSoles(pricing.total)}
          </Button>
        )}
      </div>
      <div className="hidden w-80 shrink-0 border-l p-4 md:block">
        <CartPanel
          items={cart.items}
          pricing={pricing}
          worker={worker?.applied ?? null}
          workerNotice={workerNotice}
          onAddWorker={() => {
            setMobileCartOpen(false);
            setWorkerDialogOpen(true);
          }}
          onRemoveWorker={() => setWorker(null)}
          paymentType={paymentType}
          onPaymentTypeChange={setPaymentType}
          onIncrease={increaseQty}
          onDecrease={decreaseQty}
          onRemove={cart.removeItem}
          onToggleCourtesy={toggleCourtesy}
          courtesy={{
            approvedBy: courtesyApproval?.adminName ?? null,
            needsApproval: courtesyNeedsApproval,
          }}
          onRequestCourtesyApproval={() => {
            setMobileCartOpen(false);
            setCourtesyRequest({
              saleId: currentSaleId(),
              lines: courtesyLines(null),
              addProductId: null,
            });
          }}
          onCheckout={startCheckout}
        />
      </div>
      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="bottom" className="h-[80vh]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShoppingBasketIcon className="size-5 text-brand-blue" aria-hidden />
              Cesta
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden px-4 pb-4">
            <CartPanel
              items={cart.items}
              pricing={pricing}
              worker={worker?.applied ?? null}
              workerNotice={workerNotice}
              onAddWorker={() => {
                setMobileCartOpen(false);
                setWorkerDialogOpen(true);
              }}
              onRemoveWorker={() => setWorker(null)}
              paymentType={paymentType}
              onPaymentTypeChange={setPaymentType}
              showTitle={false}
              onIncrease={increaseQty}
              onDecrease={decreaseQty}
              onRemove={cart.removeItem}
              onToggleCourtesy={toggleCourtesy}
              courtesy={{
                approvedBy: courtesyApproval?.adminName ?? null,
                needsApproval: courtesyNeedsApproval,
              }}
              onRequestCourtesyApproval={() => {
                setMobileCartOpen(false);
                setCourtesyRequest({
              saleId: currentSaleId(),
              lines: courtesyLines(null),
              addProductId: null,
            });
              }}
              onCheckout={() => {
                setMobileCartOpen(false);
                startCheckout();
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
      <CheckoutDialog
        open={checkoutOpen}
        pricing={pricing}
        workerName={worker?.applied.fullName ?? null}
        courtesyApprovedBy={courtesyApproval?.adminName ?? null}
        paymentType={paymentType}
        onOpenChange={setCheckoutOpen}
        onConfirm={handleConfirm}
      />
      <CourtesyDialog
        open={courtesyRequest !== null}
        onOpenChange={(open) => !open && setCourtesyRequest(null)}
        saleId={courtesyRequest?.saleId ?? ""}
        lines={courtesyRequest?.lines ?? []}
        onApproved={handleCourtesyApproved}
      />
      <WorkerDiscountDialog
        open={workerDialogOpen}
        onOpenChange={setWorkerDialogOpen}
        onApplied={(applied) => void applyWorker(applied)}
      />
    </div>
  );
}

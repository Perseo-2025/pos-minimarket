"use client";

import { ShoppingBasketIcon, ShoppingCartIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
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
import {
  CatalogAge,
  ScanFlash,
  ScannerStatus,
  useScanFlash,
} from "@/components/scanner/scanner-status";
import { buildBarcodeIndex } from "@/domain/services/barcode-scan";
import type { CaptureSource } from "@/domain/value-objects/capture-source";
import { useCart } from "@/hooks/use-cart";
import { useScanner } from "@/hooks/use-scanner";
import { useCashShift } from "@/hooks/use-cash-shift";
import { enqueueSale } from "@/infrastructure/offline/queue";
import { runSync } from "@/infrastructure/offline/sync-engine";
import type { CachedPolicy, PendingSale } from "@/infrastructure/offline/types";
import {
  getWorkerSnapshot,
  refreshWorkerSnapshot,
} from "@/infrastructure/offline/worker-cache";
import { storeDateKey } from "@/domain/value-objects/store-time";
import { formatSoles } from "@/lib/money";
import { CartPanel } from "./cart-panel";
import { type SidebarCategory, CategorySidebar } from "./category-sidebar";
import { CheckoutDialog } from "./checkout-dialog";
import {
  type CourtesyApproval,
  type CourtesyLine,
  CourtesyDialog,
} from "./courtesy-dialog";
import { type ShelfExpiry, ExpiryReminder } from "./expiry-reminder";
import { OfflineIndicator } from "./offline-indicator";
import { OpenShiftPanel } from "./open-shift-panel";
import { ProductGrid } from "./product-grid";
import { SearchBar } from "./search-bar";
import { ShiftMenu } from "./shift-menu";
import { type AppliedWorker, WorkerDiscountDialog } from "./worker-discount-dialog";

// A worker's PIN check is valid for one sale and a short time only: it can't
// be reused for the next customers in the queue.
const WORKER_VERIFICATION_TTL_MS = 10 * 60 * 1000;

type Product = {
  id: number;
  name: string;
  barcode: string | null;
  categoryId: number;
  categoryName: string;
  categoryIcon: string | null;
  priceSale: number;
  workerDiscountPercent: number;
  imageUrl?: string | null;
};

type BoxCode = { id: number; productId: number; barcode: string | null; name: string };

export function PosScreen({
  products,
  cashierId,
  shelfExpiry,
  boxCodes,
  catalogAt,
}: {
  products: Product[];
  cashierId: number;
  boxCodes: BoxCode[];
  // When the server built this catalog (old = page served from the cache).
  catalogAt: string;
  // Shop-floor lots to check (expired or inside their warning window).
  shelfExpiry: ShelfExpiry[];
}) {
  const cart = useCart();
  // Selling needs an open till shift ("Abrir caja") on this device.
  const cash = useCashShift(cashierId);
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
    saleUuid: string;
    lines: CourtesyLine[];
    addProductId: number | null;
  } | null>(null);
  // The sale's uuid exists before checkout: a courtesy approval is signed for
  // it, and it is the sync's idempotency key (the numeric id comes later,
  // from the server).
  const saleUuidRef = useRef<string | null>(null);
  function currentSaleUuid() {
    saleUuidRef.current ??= crypto.randomUUID();
    return saleUuidRef.current;
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

  function courtesyLines(extraProductId: number | null): CourtesyLine[] {
    return cart.items
      .filter((item) => item.isCourtesy || item.productId === extraProductId)
      .map((item) => ({
        productId: item.productId,
        productName: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      }));
  }

  function toggleCourtesy(productId: number) {
    const item = cart.items.find((i) => i.productId === productId);
    if (!item) return;
    if (item.isCourtesy) {
      cart.setCourtesy(productId, false);
      return;
    }
    setMobileCartOpen(false);
    setCourtesyRequest({
      saleUuid: currentSaleUuid(),
      lines: courtesyLines(productId),
      addProductId: productId,
    });
  }

  function handleCourtesyApproved(approval: CourtesyApproval) {
    if (courtesyRequest?.addProductId != null) {
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
    const seen = new Set<number>();
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

  const [chosenCategory, setSelectedCategory] = useState<number | null>(
    () => categories[0]?.value ?? null,
  );
  // If the chosen category disappears after a catalog refresh (deactivated
  // in the admin panel), fall back to the first one instead of a blank grid.
  const selectedCategory = categories.some((c) => c.value === chosenCategory)
    ? chosenCategory
    : (categories[0]?.value ?? null);

  const query = search.trim().toLowerCase();
  const visibleProducts =
    query.length > 0
      ? products.filter((p) => p.name.toLowerCase().includes(query))
      : products.filter((p) => p.categoryId === selectedCategory);

  async function handleConfirm() {
    if (courtesyNeedsApproval) return;
    const sale: PendingSale = {
      id: currentSaleUuid(),
      cashierId,
      shiftUuid: cash.shift?.uuid,
      paymentType,
      items: cart.items.map((item, index) => ({
        productId: item.productId,
        productName: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: lineTotal(item),
        discountPercent: pricing.lines[index].discountPercent,
        discountAmount: pricing.lines[index].discountAmount,
        isCourtesy: item.isCourtesy,
        captureSource: item.captureSource,
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
    await cash.countSale();
    void runSync();

    cart.clear();
    setCheckoutOpen(false);
    // The worker and any courtesy belong to this sale only: the next
    // customer starts clean, with a new sale uuid.
    setWorker(null);
    setCourtesyApproval(null);
    saleUuidRef.current = null;
    // Most sales are cash — start the next one from there.
    setPaymentType("cash");
    toast.success(`Venta registrada · ${PAYMENT_TYPE_LABELS[paymentType]}`, {
      description: workerName
        ? `${workerName}${points > 0 ? ` ganó ${points} puntos` : ""}`
        : undefined,
    });
  }

  // Computed on the device: the page may have been cached offline.
  const todayKey = storeDateKey(new Date());

  // The till can't know which lot is in the cashier's hand: when the oldest
  // lot on the shelf is expired, ask to check the package before charging.
  function handleSelect(
    product: Parameters<typeof cart.addItem>[0],
    source: CaptureSource = "manual",
  ) {
    cart.addItem(product, source);
    const expired = shelfExpiry.find(
      (item) => item.productId === product.id && item.expiresAt < todayKey,
    );
    if (expired) {
      toast.warning(`Revisa la fecha de ${product.name}`, {
        id: `expired-${product.id}`,
        description: `Hay unidades que vencieron el ${expired.expiresAt.split("-").reverse().join("/")}. Si el envase está vencido, retíralo y no lo cobres.`,
      });
    }
  }

  const barcodes = useMemo(
    () =>
      buildBarcodeIndex({
        units: products.map((p) => ({ productId: p.id, barcode: p.barcode })),
        presentations: boxCodes,
      }),
    [products, boxCodes],
  );
  const feedback = useScanFlash();

  // The ring reader at the till: a scan adds the unit to the basket. Paused
  // while a dialog (charge, worker, courtesy) has the cashier's attention.
  const { lastScanAt } = useScanner(
    (code, source) => {
      const target = barcodes.get(code);
      if (target?.kind === "unit") {
        const product = products.find((p) => p.id === target.productId);
        if (product) {
          handleSelect(product, source);
          feedback.ok();
          return;
        }
      }
      feedback.fail();
      if (target?.kind === "presentation") {
        const box = boxCodes.find((b) => b.id === target.presentationId);
        const product = products.find((p) => p.id === target.productId);
        toast.warning(`Ese es el código del ${box?.name ?? "empaque"}`, {
          id: "scan-box",
          description: `En caja se cobra por unidad: escanea ${product ? `la unidad de ${product.name}` : "la unidad"}.`,
        });
        return;
      }
      toast.error("Código no registrado", {
        id: "scan-unknown",
        description: `${code}. Búscalo por nombre y avisa al administrador para que lo registre.`,
      });
    },
    {
      enabled: !checkoutOpen && !workerDialogOpen && courtesyRequest === null,
    },
  );

  function increaseQty(id: number) {
    cart.setQuantity(
      id,
      (cart.items.find((i) => i.productId === id)?.quantity ?? 0) + 1,
    );
  }

  function decreaseQty(id: number) {
    cart.setQuantity(
      id,
      (cart.items.find((i) => i.productId === id)?.quantity ?? 0) - 1,
    );
  }

  if (cash.loading) return null;
  if (!cash.shift) return <OpenShiftPanel onOpen={cash.open} />;

  return (
    <div className="flex h-[calc(100vh-57px)]">
      <ScanFlash flash={feedback.flash} />
      <CategorySidebar
        categories={categories}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-center gap-3 border-b p-3">
          <SearchBar value={search} onChange={setSearch} />
          <div className="absolute right-4 flex items-center gap-2">
            <ShiftMenu shift={cash.shift} onMove={cash.move} onClose={cash.close} />
            <ExpiryReminder items={shelfExpiry} todayKey={todayKey} />
            <CatalogAge generatedAt={catalogAt} />
            <ScannerStatus lastScanAt={lastScanAt} />
            <OfflineIndicator />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
          {products.length === 0 ? (
            <EmptyState
              icon={ShoppingBasketIcon}
              title="Aún no hay productos en la tienda"
              description="Cuando el almacén traslade mercadería a la Tienda, aparecerá aquí lista para vender."
            />
          ) : (
            <ProductGrid
              products={visibleProducts}
              onSelect={handleSelect}
              showWorkerDiscount={worker !== null}
            />
          )}
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
              saleUuid: currentSaleUuid(),
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
              saleUuid: currentSaleUuid(),
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
        saleUuid={courtesyRequest?.saleUuid ?? ""}
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

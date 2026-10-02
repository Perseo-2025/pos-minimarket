"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createProduct, updateProduct } from "@/actions/products";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryGlyph } from "@/components/pos/category-glyph";
import { ProductImageField } from "./product-image-field";
import { ProfitPreview } from "./profit-preview";
import { WorkerDiscountField } from "./worker-discount-field";

type Product = {
  id: number;
  name: string;
  barcode: string | null;
  description: string | null;
  categoryId: number;
  priceSale: string;
  // Precio de compra; null = not entered yet.
  priceCost: string | null;
  // Expiry control set on the product; null = follow the category.
  tracksExpiry: boolean | null;
  workerDiscountAmount: number;
  imageUrl: string | null;
};

export type CategoryOption = {
  id: number;
  name: string;
  icon: string | null;
  isActive: boolean;
  tracksExpiry: boolean;
};

const EXPIRY_CHOICES = { inherit: null, yes: true, no: false } as const;
type ExpiryChoice = keyof typeof EXPIRY_CHOICES;
const toExpiryChoice = (value: boolean | null | undefined): ExpiryChoice =>
  value === true ? "yes" : value === false ? "no" : "inherit";

// Fire-and-forget: an upload that never made it into a product. keepalive
// lets the request finish even if the page is navigating away.
function discardUpload(url: string) {
  void fetch("/api/uploads/product-image", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    keepalive: true,
  }).catch(() => {});
}

export function ProductForm({
  product,
  categories,
  defaultCategoryId,
  trigger,
}: {
  product?: Product;
  categories: CategoryOption[];
  // Preselected for new products (e.g. when the list is filtered by one).
  defaultCategoryId?: number;
  trigger: React.ReactNode;
}) {
  const savedImageUrl = product?.imageUrl ?? null;

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(product?.name ?? "");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  // Active categories, plus the product's current one if it was deactivated
  // meanwhile, so editing other fields doesn't force a recategorization.
  const options = categories.filter(
    (c) => c.isActive || c.id === product?.categoryId,
  );
  const initialCategoryId =
    product?.categoryId ??
    options.find((c) => c.id === defaultCategoryId)?.id ??
    options[0]?.id ??
    null;
  const [categoryId, setCategoryId] = useState<number | null>(initialCategoryId);
  const [error, setError] = useState<string | null>(null);
  const [priceSale, setPriceSale] = useState(product?.priceSale ?? "");
  const [priceCost, setPriceCost] = useState(product?.priceCost ?? "");
  const [expiry, setExpiry] = useState<ExpiryChoice>(
    toExpiryChoice(product?.tracksExpiry),
  );
  const [workerDiscount, setWorkerDiscount] = useState(
    product?.workerDiscountAmount ?? 0,
  );
  const [imageUrl, setImageUrl] = useState(savedImageUrl);
  const [uploading, setUploading] = useState(false);

  // Always start from what is actually saved — otherwise edits made and then
  // cancelled would reappear the next time the dialog opens.
  function resetForm() {
    setName(product?.name ?? "");
    setBarcode(product?.barcode ?? "");
    setDescription(product?.description ?? "");
    setCategoryId(initialCategoryId);
    setError(null);
    setPriceSale(product?.priceSale ?? "");
    setPriceCost(product?.priceCost ?? "");
    setExpiry(toExpiryChoice(product?.tracksExpiry));
    setWorkerDiscount(product?.workerDiscountAmount ?? 0);
    setImageUrl(savedImageUrl);
  }

  // The current photo is an unsaved upload (not the product's stored one).
  const hasUnsavedUpload = imageUrl !== null && imageUrl !== savedImageUrl;

  function handleImageChange(next: string | null) {
    // Replacing/removing a photo uploaded in this session: nothing references
    // it yet, so delete it now. The product's saved photo is only deleted by
    // the server once the new one is actually saved.
    if (hasUnsavedUpload) discardUpload(imageUrl);
    setImageUrl(next);
  }

  function handleOpenChange(next: boolean) {
    // Closing mid-upload would orphan the file that is still arriving.
    if (!next && uploading) return;
    if (next) resetForm();
    else if (hasUnsavedUpload) discardUpload(imageUrl);
    setOpen(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);

    startTransition(async () => {
      const input = {
        name,
        barcode,
        description,
        categoryId,
        priceSale,
        priceCost,
        tracksExpiry: EXPIRY_CHOICES[expiry],
        workerDiscountAmount: workerDiscount,
        imageUrl,
      };
      try {
        const result = product
          ? await updateProduct({ id: product.id, ...input })
          : await createProduct(input);

        if (!result.ok) {
          // Business-rule message from the server (e.g. inactive category).
          setError(result.error);
          return;
        }
        toast.success(product ? "Producto actualizado" : "Producto creado");
        // Closed directly (not via handleOpenChange): the photo is saved now.
        setOpen(false);
      } catch {
        toast.error("No se pudo guardar el producto");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {product ? "Editar producto" : "Nuevo producto"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="product-image">Foto</Label>
            <ProductImageField
              value={imageUrl}
              onChange={handleImageChange}
              onUploadingChange={setUploading}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="barcode">Código de barras de la unidad</Label>
            <Input
              id="barcode"
              inputMode="numeric"
              placeholder="Toca aquí y dispara el lector"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              // The reader ends every code with Enter: it fills the field,
              // it must not save the half-filled form.
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              El de la botella o el paquete suelto. El de la caja o display va en
              Presentaciones.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Descripción</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="category">Categoría</Label>
            {options.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay categorías activas. Crea una en{" "}
                <Link href="/admin/categories" className="underline">
                  Categorías
                </Link>{" "}
                antes de agregar productos.
              </p>
            ) : (
              <Select
                value={categoryId}
                // Lets the trigger show the name instead of the raw id.
                items={options.map((c) => ({ value: c.id, label: c.name }))}
                onValueChange={(value) => value && setCategoryId(value as number)}
              >
                <SelectTrigger id="category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <CategoryGlyph icon={c.icon} />
                      {c.name}
                      {!c.isActive && " (inactiva)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="priceCost">Precio de compra (S/)</Label>
              <Input
                id="priceCost"
                type="number"
                step="0.01"
                min="0"
                placeholder="Opcional"
                value={priceCost}
                onChange={(e) => setPriceCost(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Lo que te cuesta una unidad.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="priceSale">Precio de venta (S/)</Label>
              <Input
                id="priceSale"
                type="number"
                step="0.10"
                min="0"
                value={priceSale}
                onChange={(e) => setPriceSale(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Lo que cobra la caja.
              </p>
            </div>
          </div>
          <ProfitPreview
            priceSale={Number(priceSale) || 0}
            priceCost={priceCost === "" ? null : Number(priceCost)}
            workerDiscountAmount={workerDiscount}
          />
          <div className="flex flex-col gap-2">
            <Label id="product-expiry-label">Fecha de vencimiento</Label>
            <ToggleGroup
              aria-labelledby="product-expiry-label"
              value={[expiry]}
              onValueChange={(next) => {
                const [choice] = next as ExpiryChoice[];
                if (choice) setExpiry(choice);
              }}
              variant="outline"
              spacing={1}
              className="grid w-full grid-cols-3"
            >
              {(
                [
                  [
                    "inherit",
                    `Como la categoría (${
                      categories.find((c) => c.id === categoryId)?.tracksExpiry
                        ? "vence"
                        : "no vence"
                    })`,
                  ],
                  ["yes", "Sí vence"],
                  ["no", "No vence"],
                ] as const
              ).map(([value, label]) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  className="h-auto py-1.5 text-xs whitespace-normal aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                >
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="flex flex-col gap-2">
            <Label id="worker-discount-label">Descuento para trabajadores</Label>
            <WorkerDiscountField
              // Remount per dialog open so the "Otro" state follows the value.
              key={open ? "open" : "closed"}
              value={workerDiscount}
              onChange={setWorkerDiscount}
              price={Number(priceSale) || 0}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="submit"
              disabled={isPending || uploading || options.length === 0}
            >
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

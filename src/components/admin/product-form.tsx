"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
} from "@/domain/entities/product";

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  priceSale: string;
};

export function ProductForm({
  product,
  trigger,
}: {
  product?: Product;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [category, setCategory] = useState(
    product?.category ?? PRODUCT_CATEGORIES[0],
  );
  const [priceSale, setPriceSale] = useState(product?.priceSale ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    startTransition(async () => {
      try {
        if (product) {
          await updateProduct({
            id: product.id,
            name,
            description,
            category,
            priceSale,
          });
          toast.success("Producto actualizado");
        } else {
          await createProduct({ name, description, category, priceSale });
          toast.success("Producto creado");
          setName("");
          setDescription("");
          setPriceSale("");
        }
        setOpen(false);
      } catch {
        toast.error("No se pudo guardar el producto");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {product ? "Editar producto" : "Nuevo producto"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            <Label htmlFor="description">Descripción</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="category">Categoría</Label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value ?? PRODUCT_CATEGORIES[0])}
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {PRODUCT_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

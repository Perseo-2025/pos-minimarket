"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deactivateProduct, reactivateProduct } from "@/actions/products";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatSoles } from "@/lib/money";
import { ProductForm } from "./product-form";

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  priceSale: string;
  isActive: boolean;
};

export function ProductTable({ products }: { products: Product[] }) {
  const [isPending, startTransition] = useTransition();

  function handleToggleActive(product: Product) {
    startTransition(async () => {
      try {
        if (product.isActive) {
          await deactivateProduct(product.id);
          toast.success(`${product.name} desactivado`);
        } else {
          await reactivateProduct(product.id);
          toast.success(`${product.name} reactivado`);
        }
      } catch {
        toast.error("No se pudo actualizar el producto");
      }
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Categoría</TableHead>
          <TableHead>Precio</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id}>
            <TableCell>{product.name}</TableCell>
            <TableCell>{product.category}</TableCell>
            <TableCell>{formatSoles(product.priceSale)}</TableCell>
            <TableCell>
              <Badge variant={product.isActive ? "default" : "secondary"}>
                {product.isActive ? "Activo" : "Inactivo"}
              </Badge>
            </TableCell>
            <TableCell className="flex justify-end gap-2">
              <ProductForm
                product={product}
                trigger={
                  <Button size="sm" variant="outline">
                    Editar
                  </Button>
                }
              />
              <Button
                size="sm"
                variant={product.isActive ? "destructive" : "outline"}
                disabled={isPending}
                onClick={() => handleToggleActive(product)}
              >
                {product.isActive ? "Desactivar" : "Reactivar"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

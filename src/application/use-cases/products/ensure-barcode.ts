import { ValidationError } from "@/domain/errors";
import type { PresentationRepository } from "@/domain/repositories/presentation-repository";
import type { ProductRepository } from "@/domain/repositories/product-repository";

// One code, one thing: a scan must resolve to exactly one unit or one
// box/display, never to both.
export async function ensureBarcodeFree(
  repos: { products: ProductRepository; presentations: PresentationRepository },
  barcode: string | null,
  self: { productId?: number; presentationId?: number },
) {
  if (!barcode) return;
  const [onProduct, onPresentation] = await Promise.all([
    repos.products.existsByBarcode(barcode, self.productId),
    repos.presentations.existsByBarcode(barcode, self.presentationId),
  ]);
  if (onProduct || onPresentation) {
    throw new ValidationError("Ese código de barras ya está registrado en otro producto");
  }
}

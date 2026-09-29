import { NextResponse } from "next/server";
import {
  MAX_PRODUCT_IMAGE_BYTES,
  uploadProductImageUseCase,
} from "@/application/use-cases/products/upload-product-image";
import { discardProductImageUseCase } from "@/application/use-cases/products/discard-product-image";
import { InvalidImageError } from "@/domain/errors";
import { auth } from "@/infrastructure/auth";
import { productRepository } from "@/infrastructure/repositories";
import { imageStorage } from "@/infrastructure/storage";

// A Route Handler rather than a Server Action: Server Actions cap request
// bodies at 1 MB by default, and product photos routinely exceed that.
async function isAdmin() {
  const session = await auth();
  return session?.user?.role === "admin";
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }
  // Cheap early reject before buffering the whole file.
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "La imagen supera los 2 MB" },
      { status: 413 },
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await uploadProductImageUseCase(imageStorage, bytes);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidImageError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Product image upload failed", error);
    return NextResponse.json(
      { error: "No se pudo subir la imagen" },
      { status: 500 },
    );
  }
}

// Discards an upload the admin never saved (replaced it or cancelled).
export async function DELETE(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  try {
    const result = await discardProductImageUseCase(
      { products: productRepository, images: imageStorage },
      body?.url,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InvalidImageError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Product image discard failed", error);
    return NextResponse.json(
      { error: "No se pudo borrar la imagen" },
      { status: 500 },
    );
  }
}

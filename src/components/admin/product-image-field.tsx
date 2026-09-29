"use client";

import {
  CircleAlertIcon,
  ImageUpIcon,
  InfoIcon,
  Loader2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { MAX_PRODUCT_IMAGE_BYTES } from "@/application/use-cases/products/upload-product-image";
import { ProductImagePlaceholder } from "@/components/pos/product-image-placeholder";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Limit on the original file picked by the admin. It gets compressed before
// upload, so this can be generous: it covers any phone photo.
const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;
// Product cards render at ~200–300 px; 800 px covers retina screens.
const TARGET_DIMENSION = 800;
// Below this the photo looks blurry on the POS cards — warn, don't block.
const MIN_RECOMMENDED_SIDE = 400;

const formatKB = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

// Phone photos are several MB; downscale + re-encode to WebP in the browser
// so uploads stay small and fast (and well under the server's 2 MB limit).
async function compressImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, TARGET_DIMENSION / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen"))),
      "image/webp",
      0.85,
    ),
  );

  return {
    blob,
    original: { width, height },
    result: { width: canvas.width, height: canvas.height },
  };
}

type Notice =
  | { kind: "error"; message: string }
  | { kind: "warning"; message: string }
  | { kind: "success"; message: string };

export function ProductImageField({
  value,
  onChange,
  onUploadingChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  function setBusy(busy: boolean) {
    setUploading(busy);
    onUploadingChange?.(busy);
  }

  async function handleFile(file: File) {
    // Checked before doing any work, so the admin gets an immediate answer.
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setNotice({
        kind: "error",
        message: `"${file.name}" no es JPG, PNG ni WebP.`,
      });
      return;
    }
    if (file.size > MAX_ORIGINAL_BYTES) {
      setNotice({
        kind: "error",
        message: `La imagen pesa ${formatKB(file.size)}. El máximo es ${formatKB(MAX_ORIGINAL_BYTES)}.`,
      });
      return;
    }

    setNotice(null);
    setBusy(true);
    try {
      const { blob, original, result } = await compressImage(file);
      if (blob.size > MAX_PRODUCT_IMAGE_BYTES) {
        throw new Error("La imagen sigue siendo demasiado pesada tras optimizarla.");
      }

      const body = new FormData();
      body.append("file", blob, "product.webp");
      const response = await fetch("/api/uploads/product-image", {
        method: "POST",
        body,
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.error);

      onChange(json.url);

      const optimized = `${formatKB(file.size)} → ${formatKB(blob.size)} (${result.width}×${result.height} px)`;
      setNotice(
        Math.min(original.width, original.height) < MIN_RECOMMENDED_SIDE
          ? {
              kind: "warning",
              message: `La foto mide ${original.width}×${original.height} px y puede verse borrosa. Se recomienda al menos ${MIN_RECOMMENDED_SIDE}×${MIN_RECOMMENDED_SIDE} px. Optimizada: ${optimized}.`,
            }
          : { kind: "success", message: `Foto optimizada: ${optimized}.` },
      );
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "No se pudo subir la imagen. Inténtalo de nuevo.",
      });
    } finally {
      setBusy(false);
      // Allow picking the same file again after a failure.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <div className="relative w-28 shrink-0">
          <ProductImagePlaceholder src={value} alt="Foto del producto" />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/70">
              <Loader2Icon className="size-5 animate-spin" aria-hidden />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="sr-only"
            id="product-image"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <ImageUpIcon data-icon="inline-start" />
            {uploading ? "Subiendo..." : value ? "Cambiar foto" : "Subir foto"}
          </Button>
          {value && !uploading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setNotice(null);
                onChange(null);
              }}
            >
              <XIcon data-icon="inline-start" />
              Quitar foto
            </Button>
          )}
        </div>
      </div>

      {notice?.kind === "error" ? (
        <Alert variant="destructive" aria-live="assertive">
          <CircleAlertIcon />
          <AlertTitle>No se pudo usar esta imagen</AlertTitle>
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      ) : notice?.kind === "warning" ? (
        <Alert
          aria-live="polite"
          className="border-amber-500/40 text-amber-800 dark:text-amber-300"
        >
          <TriangleAlertIcon />
          <AlertTitle>Resolución baja</AlertTitle>
          <AlertDescription className="text-amber-800/90 dark:text-amber-300/90">
            {notice.message}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert aria-live="polite">
          <InfoIcon />
          <AlertTitle>
            {notice?.kind === "success" ? "Foto lista" : "Requisitos de la foto"}
          </AlertTitle>
          <AlertDescription>
            {notice?.kind === "success" ? (
              notice.message
            ) : (
              <ul className="list-disc space-y-0.5 pl-4">
                <li>Formatos: JPG, PNG o WebP.</li>
                <li>Peso máximo: {formatKB(MAX_ORIGINAL_BYTES)}.</li>
                <li>
                  Recomendado: foto cuadrada de 800×800 px, con el producto
                  centrado y fondo claro.
                </li>
                <li>Se optimiza sola antes de subir (≈ 50–150 KB).</li>
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

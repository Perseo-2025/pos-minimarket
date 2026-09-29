import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Fixed 4:3 aspect ratio matches a typical product-card photo; swap the
// `src` prop for a real image once product photos exist.
export function ProductImagePlaceholder({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- product photo URLs will be arbitrary S3 URLs
      <img
        src={src}
        alt={alt}
        className={cn("aspect-4/3 w-full rounded-md object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex aspect-4/3 w-full items-center justify-center rounded-md bg-muted",
        className,
      )}
    >
      <ImageIcon className="size-8 text-muted-foreground/50" />
    </div>
  );
}

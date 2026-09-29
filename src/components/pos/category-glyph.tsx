import { TagIcon } from "lucide-react";
import type { CategoryIcon } from "@/domain/entities/category";
import { CATEGORY_ICON_COMPONENTS } from "./pos-icons";

// Renders a category's icon from its stored key. Unknown or missing keys
// fall back to a generic tag.
export function CategoryGlyph({
  icon,
  className,
}: {
  icon: string | null | undefined;
  className?: string;
}) {
  const Icon = CATEGORY_ICON_COMPONENTS[icon as CategoryIcon] ?? TagIcon;
  return <Icon className={className} aria-hidden />;
}

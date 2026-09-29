"use client";

import { cn } from "@/lib/utils";
import { CategoryGlyph } from "./category-glyph";

export type SidebarCategory = {
  value: string;
  label: string;
  icon: string | null;
};

export function CategorySidebar({
  categories,
  selected,
  onSelect,
}: {
  categories: SidebarCategory[];
  selected: string;
  onSelect: (category: string) => void;
}) {
  return (
    <aside className="flex w-24 shrink-0 flex-col gap-2 overflow-y-auto border-r bg-sidebar p-2 sm:w-36 sm:p-3">
      {categories.map((category) => {
        const isSelected = category.value === selected;
        return (
          <button
            key={category.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(category.value)}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-lg px-2 py-3 text-center text-xs font-heading font-semibold transition-colors sm:min-h-20 sm:py-4 sm:text-sm",
              isSelected
                ? "bg-brand-orange text-white shadow-sm"
                : "bg-transparent text-muted-foreground hover:bg-brand-blue/10 hover:text-brand-blue",
            )}
          >
            <CategoryGlyph icon={category.icon} className="size-5 sm:size-6" />
            {category.label}
          </button>
        );
      })}
    </aside>
  );
}

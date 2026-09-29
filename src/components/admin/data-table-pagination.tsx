"use client";

import type * as React from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

// Page numbers to render: always the first and last page, plus a window
// around the current one; gaps become an ellipsis.
function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);

  const result: (number | "gap")[] = [];
  for (const p of sorted) {
    const prev = result.at(-1);
    if (typeof prev === "number" && p - prev > 1) result.push("gap");
    result.push(p);
  }
  return result;
}

export function DataTablePagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  itemLabel = "registros",
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const isFirst = page === 1;
  const isLast = page === pageCount;

  // Anchors need an href to be keyboard-focusable; navigation stays client-side.
  const go = (target: number) => ({
    href: "#",
    onClick: (event: React.MouseEvent) => {
      event.preventDefault();
      onPageChange(target);
    },
  });

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
      <p className="text-sm text-muted-foreground tabular-nums">
        Mostrando {from}–{to} de {total} {itemLabel}
      </p>
      {pageCount > 1 && (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                text="Anterior"
                aria-label="Página anterior"
                aria-disabled={isFirst}
                className={cn(isFirst && "pointer-events-none opacity-50")}
                {...go(page - 1)}
              />
            </PaginationItem>
            {pageWindow(page, pageCount).map((p, i) =>
              p === "gap" ? (
                <PaginationItem key={`gap-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    isActive={p === page}
                    aria-label={`Página ${p}`}
                    className="tabular-nums"
                    {...go(p)}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                text="Siguiente"
                aria-label="Página siguiente"
                aria-disabled={isLast}
                className={cn(isLast && "pointer-events-none opacity-50")}
                {...go(page + 1)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

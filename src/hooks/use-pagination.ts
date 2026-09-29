"use client";

import { useState } from "react";

export const DEFAULT_PAGE_SIZE = 10;

export function usePagination<T>(items: T[], pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  // Clamp instead of resetting in an effect: if rows are removed (e.g. after
  // a revalidation) the table falls back to the last valid page.
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;

  return {
    page: currentPage,
    pageCount,
    pageSize,
    total: items.length,
    rows: items.slice(start, start + pageSize),
    setPage: (next: number) =>
      setPage(Math.min(Math.max(1, next), pageCount)),
  };
}

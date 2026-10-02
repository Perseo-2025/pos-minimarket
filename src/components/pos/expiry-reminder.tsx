"use client";

import { CalendarClockIcon } from "lucide-react";
import { useState } from "react";
import { ExpiryBadge, formatExpiry } from "@/components/expiry-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// A shop-floor lot inside its warning window (or expired), for the cashier.
export type ShelfExpiry = {
  productId: number;
  productName: string;
  quantity: number;
  expiresAt: string;
  warningDays: number;
};

// "Revisa en góndola": the cashier's daily to-do of products to put in front
// or set aside, one tap away from the till.
export function ExpiryReminder({
  items,
  todayKey,
}: {
  items: ShelfExpiry[];
  todayKey: string;
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  const expired = items.filter((item) => item.expiresAt < todayKey).length;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className={
          expired > 0
            ? "border-destructive/40 text-destructive hover:bg-destructive/10"
            : "border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
        }
      >
        <CalendarClockIcon data-icon="inline-start" />
        <span className="hidden sm:inline">Por vencer</span> {items.length}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Revisa en góndola</SheetTitle>
            <SheetDescription>
              Pon adelante lo que vence primero.
              {expired > 0 &&
                " Lo vencido sepáralo y avisa al administrador: no se vende."}
            </SheetDescription>
          </SheetHeader>
          <ul className="divide-y px-4">
            {items.map((item) => (
              <li
                key={`${item.productId}-${item.expiresAt}`}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="font-medium">{item.productName}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.quantity} und · vence {formatExpiry(item.expiresAt)}
                  </div>
                </div>
                <ExpiryBadge
                  expiresAt={item.expiresAt}
                  todayKey={todayKey}
                  warningDays={item.warningDays}
                />
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}

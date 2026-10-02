import { ExpiryBadge, formatExpiry } from "@/components/expiry-badge";
import type { StockLot } from "@/domain/entities/inventory";
import { storeDateKey } from "@/domain/value-objects/store-time";

// The dated lots of one location, soonest first.
export function LotList({
  lots,
  warningDays,
}: {
  lots: StockLot[];
  warningDays: number;
}) {
  if (lots.length === 0) {
    return (
      <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
        Sin fechas registradas. Cuenta el producto para cargarlas.
      </p>
    );
  }
  const today = storeDateKey(new Date());
  return (
    <ul className="mt-2 flex flex-col gap-1 text-sm">
      {lots.map((lot) => (
        <li key={lot.expiresAt} className="flex items-center justify-between gap-2">
          <span className="tabular-nums">
            {lot.quantity} und · {formatExpiry(lot.expiresAt)}
          </span>
          <ExpiryBadge
            expiresAt={lot.expiresAt}
            todayKey={today}
            warningDays={warningDays}
          />
        </li>
      ))}
    </ul>
  );
}

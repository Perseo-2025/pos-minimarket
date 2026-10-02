import { CalendarClockIcon } from "lucide-react";
import Link from "next/link";
import { ExpiryBadge, formatExpiry } from "@/components/expiry-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ExpiringLot } from "@/domain/entities/inventory";
import { expiryInfo } from "@/domain/services/expiry";
import { round2 } from "@/domain/value-objects/money";
import { formatSoles } from "@/lib/money";

// "Por vencer": what to put in front, put on offer, return to the supplier
// or write off. Shown on the dashboard and on the inventory page.
export function ExpiringLotsPanel({
  lots,
  todayKey,
  limit,
  forWarehouse = false,
}: {
  lots: ExpiringLot[];
  todayKey: string;
  // Dashboard shows the first few with a link to the full list.
  limit?: number;
  // Warehouse screen: no money amounts and no links into the admin panel.
  forWarehouse?: boolean;
}) {
  const expired = lots.filter(
    (lot) => expiryInfo(lot.expiresAt, todayKey, lot.warningDays).status === "expired",
  );
  // Money tied up in these lots, at purchase price (when known).
  const atRisk = round2(
    lots.reduce((sum, lot) => sum + (lot.priceCost ?? 0) * lot.quantity, 0),
  );
  const shown = limit ? lots.slice(0, limit) : lots;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClockIcon className="size-5 text-amber-600" />
          Por vencer
          {lots.length > 0 && (
            <Badge variant="outline" className="tabular-nums">
              {lots.length}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {lots.length === 0
            ? "Nada por vencer dentro del aviso de cada categoría."
            : `${expired.length > 0 ? `${expired.length} ${expired.length === 1 ? "lote vencido" : "lotes vencidos"}. ` : ""}Pon adelante lo próximo a vencer, ofértalo o devuélvelo al proveedor.${atRisk > 0 && !forWarehouse ? ` Valor en riesgo: ${formatSoles(atRisk)} a precio de compra.` : ""}`}
        </CardDescription>
      </CardHeader>
      {lots.length > 0 && (
        <CardContent>
          <ul className="divide-y">
            {shown.map((lot) => (
              <li
                key={lot.lotId}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-sm"
              >
                <div className="min-w-0">
                  {forWarehouse ? (
                    <span className="font-medium">{lot.productName}</span>
                  ) : (
                    <Link
                      href={`/admin/inventory/${lot.productId}`}
                      className="font-medium hover:underline"
                    >
                      {lot.productName}
                    </Link>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {lot.quantity} und en {lot.locationName} · vence{" "}
                    {formatExpiry(lot.expiresAt)}
                  </div>
                </div>
                <ExpiryBadge
                  expiresAt={lot.expiresAt}
                  todayKey={todayKey}
                  warningDays={lot.warningDays}
                />
              </li>
            ))}
          </ul>
          {limit && lots.length > limit && !forWarehouse && (
            <Link
              href="/admin/inventory"
              className="mt-2 inline-block text-sm text-muted-foreground hover:underline"
            >
              Ver los {lots.length} lotes en Inventario
            </Link>
          )}
        </CardContent>
      )}
    </Card>
  );
}

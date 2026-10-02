import { Badge } from "@/components/ui/badge";
import {
  PURCHASE_ORDER_STATUS_LABELS,
  type PurchaseOrderStatus,
} from "@/domain/entities/purchase-order";
import { cn } from "@/lib/utils";

const TONES: Record<PurchaseOrderStatus, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  partial: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  received:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  cancelled: "text-muted-foreground",
};

export function OrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return (
    <Badge variant="outline" className={cn(TONES[status])}>
      {PURCHASE_ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}

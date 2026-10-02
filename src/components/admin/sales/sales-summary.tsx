import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  PAYMENT_TYPE_LABELS,
  PAYMENT_TYPES,
  type PaymentType,
} from "@/domain/entities/sale";
import { round2 } from "@/domain/value-objects/money";
import { formatSoles } from "@/lib/money";

type SummarySale = {
  total: number;
  discountTotal: number;
  giftTotal: number;
  paymentType: PaymentType;
  units: number;
};

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
    </Card>
  );
}

export function SalesSummary({ sales }: { sales: SummarySale[] }) {
  const total = round2(sales.reduce((sum, s) => sum + s.total, 0));
  const units = sales.reduce((sum, s) => sum + s.units, 0);
  const discount = round2(sales.reduce((sum, s) => sum + s.discountTotal, 0));
  const discounted = sales.filter((s) => s.discountTotal > 0).length;
  const gifts = round2(sales.reduce((sum, s) => sum + s.giftTotal, 0));
  const average = sales.length > 0 ? round2(total / sales.length) : 0;

  const byPayment = PAYMENT_TYPES.map((type) => {
    const matching = sales.filter((s) => s.paymentType === type);
    const amount = round2(matching.reduce((sum, s) => sum + s.total, 0));
    return {
      type,
      amount,
      count: matching.length,
      share: total > 0 ? (amount / total) * 100 : 0,
    };
  });

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Metric
        label="Total vendido"
        value={formatSoles(total)}
        hint={
          `${sales.length} ${sales.length === 1 ? "venta" : "ventas"} registradas` +
          (discount > 0
            ? ` · ${formatSoles(discount)} de descuento en ${discounted} ${discounted === 1 ? "venta" : "ventas"} a trabajadores`
            : "") +
          (gifts > 0 ? ` · ${formatSoles(gifts)} en regalos de cumpleaños` : "")
        }
      />
      <Metric
        label="Promedio por orden"
        value={formatSoles(average)}
        hint="Importe medio por venta"
      />
      <Metric
        label="Productos vendidos"
        value={units.toLocaleString("es-PE")}
        hint="Unidades en todas las órdenes"
      />
      <Card>
        <CardHeader>
          <CardDescription>Por método de pago</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {byPayment.map((row) => (
            <div key={row.type} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{PAYMENT_TYPE_LABELS[row.type]}</span>
                <span className="text-muted-foreground tabular-nums">
                  {formatSoles(row.amount)} · {row.count}
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="meter"
                aria-label={`${PAYMENT_TYPE_LABELS[row.type]}: ${Math.round(row.share)}%`}
                aria-valuenow={Math.round(row.share)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${row.share}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

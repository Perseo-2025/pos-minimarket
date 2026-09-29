import { Suspense } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listSalesByDateRangeUseCase } from "@/application/use-cases/sales/list-sales";
import { saleRepository } from "@/infrastructure/repositories";
import { formatSoles } from "@/lib/money";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Efectivo",
  yape_plin: "Yape/Plin",
  card: "Tarjeta",
};

async function SalesList() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const sales = await listSalesByDateRangeUseCase(
    saleRepository,
    startOfDay,
    endOfDay,
  );
  const dayTotal = sales.reduce((sum, sale) => sum + sale.total, 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        {sales.length} venta(s) hoy · Total {formatSoles(dayTotal)}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hora</TableHead>
            <TableHead>Cajero</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Pago</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((sale) => (
            <TableRow key={sale.id}>
              <TableCell>
                {new Date(sale.clientCreatedAt).toLocaleTimeString("es-PE")}
              </TableCell>
              <TableCell>{sale.cashierName ?? "-"}</TableCell>
              <TableCell>{sale.items.length}</TableCell>
              <TableCell>{PAYMENT_LABELS[sale.paymentType]}</TableCell>
              <TableCell className="text-right">
                {formatSoles(sale.total)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function AdminSalesPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Ventas de hoy</h1>
      <Suspense fallback={<p className="text-muted-foreground">Cargando...</p>}>
        <SalesList />
      </Suspense>
    </div>
  );
}

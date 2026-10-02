"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { cancelPurchaseOrder } from "@/actions/purchasing";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DeactivateButton } from "../deactivate-button";

export function CancelOrderButton({ orderId }: { orderId: number }) {
  const [isPending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <DeactivateButton
            label={`Anular orden #${orderId}`}
            disabled={isPending}
          />
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Anular la orden #{orderId}?</AlertDialogTitle>
          <AlertDialogDescription>
            Úsalo si el pedido no va a llegar. Lo que ya se ingresó al Almacén se
            queda como está.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() =>
              startTransition(async () => {
                const result = await cancelPurchaseOrder(orderId);
                if (result.ok) toast.success(`Orden #${orderId} anulada`);
                else toast.error(result.error);
              })
            }
          >
            Anular orden
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

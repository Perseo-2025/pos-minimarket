"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  PAYMENT_TYPE_LABELS,
  PAYMENT_TYPES,
  type PaymentType,
} from "@/domain/entities/sale";
import { PAYMENT_TYPE_ICONS } from "./pos-icons";

export function PaymentMethodPicker({
  value,
  onChange,
}: {
  value: PaymentType;
  onChange: (value: PaymentType) => void;
}) {
  return (
    <ToggleGroup
      aria-label="Método de pago"
      value={[value]}
      // Base UI emits an empty array when the pressed item is clicked again;
      // a sale always needs a method, so that deselect is ignored.
      onValueChange={(next) => {
        const [selected] = next as PaymentType[];
        if (selected) onChange(selected);
      }}
      spacing={2}
      className="grid w-full grid-cols-3"
    >
      {PAYMENT_TYPES.map((type) => {
        const Icon = PAYMENT_TYPE_ICONS[type];
        return (
          <ToggleGroupItem
            key={type}
            value={type}
            variant="outline"
            className="h-auto flex-col gap-1.5 py-3 text-sm aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:shadow-sm hover:aria-pressed:bg-primary/90 hover:aria-pressed:text-primary-foreground [&_svg:not([class*='size-'])]:size-6"
          >
            <Icon aria-hidden />
            {PAYMENT_TYPE_LABELS[type]}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

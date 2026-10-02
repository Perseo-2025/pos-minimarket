"use client";

import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Icon-only "deactivate" action used across the admin tables. The label is
// shown as a tooltip and read by screen readers. Extra props reach the
// button, so it also works as the `render` of an AlertDialogTrigger.
export function DeactivateButton({
  label,
  className,
  ...props
}: { label: string } & Omit<React.ComponentProps<typeof Button>, "children">) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            className={cn(
              "text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300",
              className,
            )}
            {...props}
          />
        }
      >
        <Trash2Icon />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

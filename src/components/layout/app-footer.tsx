import { HeartIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Signature shown at the bottom of every area. Its height is the
// --app-footer-h variable (globals.css): full-height screens such as the
// till subtract it, so the tablet never has to scroll.
export function AppFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "flex h-(--app-footer-h) shrink-0 items-center justify-center gap-1 border-t border-border/60 px-4 text-xs text-muted-foreground",
        className,
      )}
    >
      <span>
        © <span className="font-semibold tracking-wide text-foreground/70">REYPERSEO</span>. All
        rights reserved.
      </span>
      <span aria-hidden>·</span>
      <span className="inline-flex items-center gap-1">
        Made with
        <HeartIcon className="size-3.5 fill-red-500 text-red-500" aria-label="amor" />
      </span>
    </footer>
  );
}

import { StoreIcon, UserRoundIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/layout/logout-button";
import { auth } from "@/infrastructure/auth";

export default async function CashierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <span className="flex items-center gap-2 font-heading font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <StoreIcon className="size-4" aria-hidden />
          </span>
          POS NAVEGUZ · Caja
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <UserRoundIcon className="size-4" aria-hidden />
            {session.user.name}
          </span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

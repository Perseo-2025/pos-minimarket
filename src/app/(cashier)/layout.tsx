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
        <span className="font-heading font-semibold">
          POS Minimarket · Caja
        </span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {session.user.name}
          </span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

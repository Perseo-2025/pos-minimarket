import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/layout/logout-button";
import { auth } from "@/infrastructure/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/pos");

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col justify-between border-r p-4">
        <div>
          <p className="mb-4 font-heading font-semibold">
            POS Minimarket · Admin
          </p>
          <nav className="flex flex-col gap-2 text-sm">
            <Link href="/admin">Dashboard</Link>
            <Link href="/admin/products">Productos</Link>
            <Link href="/admin/users">Usuarios</Link>
            <Link href="/admin/sales">Ventas</Link>
          </nav>
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">
            {session.user.name}
          </span>
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

import { redirect } from "next/navigation";
import { homePath } from "@/domain/entities/user";
import { auth } from "@/infrastructure/auth";

export default async function Home() {
  const session = await auth();

  if (!session?.user) redirect("/login");
  redirect(homePath(session.user.role));
}

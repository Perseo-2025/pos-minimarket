"use client";

import { StoreIcon } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { AppFooter } from "@/components/layout/app-footer";
import { startSplash } from "@/components/layout/splash-screen";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    if (result?.error) {
      setIsSubmitting(false);
      setError("Usuario o contraseña incorrectos");
      return;
    }

    // The splash covers the screen while the role's view loads behind it.
    startSplash();
    router.push("/");
    router.refresh();
  }

  return (
    // White background that turns grey towards the right.
    <div className="flex min-h-screen flex-col bg-linear-to-r from-white via-slate-50 to-slate-300">
      <div className="relative flex flex-1 items-center justify-center p-4">
        <Card className="relative w-full max-w-sm shadow-2xl ring-1 ring-slate-200">
          <CardHeader className="items-center text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <StoreIcon className="size-7" aria-hidden />
            </span>
            <CardTitle className="font-heading text-2xl tracking-wide">
              NAVE<span className="text-accent">XPRESS</span>
            </CardTitle>
            <CardDescription>Ingresa con tu cuenta de la tienda</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="username">Usuario</Label>
                <Input
                  id="username"
                  placeholder="Usuario2026"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  placeholder="********"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" size="lg" disabled={isSubmitting}>
                {isSubmitting ? "Ingresando..." : "Ingresar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <AppFooter className="border-slate-300/60" />
    </div>
  );
}

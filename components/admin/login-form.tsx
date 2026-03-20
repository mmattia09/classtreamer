"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        setError(
          retryAfter
            ? `Troppi tentativi. Riprova tra ${retryAfter} secondi.`
            : "Troppi tentativi. Riprova tra poco.",
        );
      } else {
        setError("Password non valida");
      }
      setLoading(false);
      return;
    }

    router.push("/admin/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6">
      <Card className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm uppercase tracking-[0.2em] text-ocean/70">Tecnico</p>
          <Button asChild variant="ghost" className="gap-2">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Torna alle classi
            </Link>
          </Button>
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold">Accesso amministratore</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="h-14 w-full rounded-2xl border border-ocean/10 bg-white px-4 outline-none ring-ocean/20 focus:ring-4"
          />
          {error ? <p className="text-sm text-terracotta">{error}</p> : null}
          <Button type="submit" disabled={loading} className="h-14 w-full text-lg">
            Entra
          </Button>
        </form>
      </Card>
    </main>
  );
}

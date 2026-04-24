"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function DeleteStreamButton({ streamId, isLive = false }: { streamId: string; isLive?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function remove() {
    const message = isLive
      ? "Vuoi eliminare questa live? La trasmissione verrà chiusa e tutti i dati associati saranno rimossi."
      : "Vuoi eliminare questa live? Tutti i dati associati saranno rimossi.";
    if (!confirm(message)) return;
    if (!confirm("Conferma finale: l'eliminazione è irreversibile.")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/streams/${streamId}/delete`, { method: "POST" });
      if (!res.ok) return;
      router.push("/admin/streams");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="destructive" onClick={remove} disabled={loading}>
      <Trash2 className="h-4 w-4" />
      {loading ? "Eliminazione…" : "Elimina live"}
    </Button>
  );
}

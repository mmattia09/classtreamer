"use client";

import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function DuplicateStreamButton({ streamId }: { streamId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function duplicate() {
    if (!confirm("Vuoi creare una nuova bozza basata su questa stream? Le domande verranno copiate e resettate.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/streams/${streamId}/duplicate`, { method: "POST" });
      if (res.ok) {
        const { id } = await res.json() as { id: string };
        router.push(`/admin/streams/${id}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" onClick={duplicate} disabled={loading}>
      <Copy className="h-4 w-4" />
      {loading ? "Creazione…" : "Riproponi come nuova"}
    </Button>
  );
}

"use client";

import { Radio, Square, Tv2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function StreamControls({ streamId, status }: { streamId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"live" | "end" | null>(null);

  async function goLive() {
    setLoading("live");
    try {
      await fetch(`/api/admin/streams/${streamId}/live`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function endStream() {
    if (!confirm("Sei sicuro di voler terminare la stream? L'azione è irreversibile.")) return;
    setLoading("end");
    try {
      await fetch(`/api/admin/streams/${streamId}/end`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  if (status === "ENDED") return null;

  return (
    <div className="flex flex-wrap gap-2">
      {/* Show "Vai live" only for DRAFT/SCHEDULED */}
      {status !== "LIVE" && (
        <Button onClick={goLive} disabled={loading !== null}>
          <Radio className="h-4 w-4" />
          {loading === "live" ? "Avvio in corso…" : "Vai live"}
        </Button>
      )}
      {/* Show "Termina" only when actually LIVE */}
      {status === "LIVE" && (
        <Button onClick={endStream} variant="destructive" disabled={loading !== null}>
          <Square className="h-4 w-4" />
          {loading === "end" ? "Terminazione…" : "Termina stream"}
        </Button>
      )}
    </div>
  );
}

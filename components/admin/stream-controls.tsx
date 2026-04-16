"use client";

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
    <div className="flex flex-wrap gap-3">
      {status !== "LIVE" && (
        <Button onClick={goLive} disabled={loading !== null}>
          {loading === "live" ? "Avvio in corso…" : "Vai live"}
        </Button>
      )}
      <Button onClick={endStream} variant="danger" disabled={loading !== null}>
        {loading === "end" ? "Terminazione…" : "Termina stream"}
      </Button>
    </div>
  );
}

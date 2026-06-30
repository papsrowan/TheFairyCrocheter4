"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DesarchiverButton({ produitId, produitNom }: { produitId: string; produitNom: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handle() {
    if (!confirm(`Désarchiver "${produitNom}" ? Il redeviendra visible dans la caisse.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/produits/${produitId}/restore`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Erreur lors du désarchivage");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="relative z-10 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
    >
      {loading ? "..." : "Désarchiver"}
    </button>
  );
}

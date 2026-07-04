"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Truck, PackageCheck, Loader2 } from "lucide-react";

const ACTIONS: Record<string, { statut: string; label: string; icon: typeof Check; cls: string }[]> = {
  EN_ATTENTE: [
    { statut: "VALIDEE", label: "Valider",  icon: Check, cls: "bg-emerald-600 hover:bg-emerald-700" },
    { statut: "REFUSEE", label: "Refuser",  icon: X,     cls: "bg-red-600 hover:bg-red-700" },
  ],
  VALIDEE: [
    { statut: "EXPEDIEE", label: "Marquer expédiée", icon: Truck, cls: "bg-blue-600 hover:bg-blue-700" },
  ],
  EXPEDIEE: [
    { statut: "LIVREE", label: "Marquer livrée", icon: PackageCheck, cls: "bg-emerald-600 hover:bg-emerald-700" },
  ],
};

export function CommandeActions({ commandeId, statut }: { commandeId: string; statut: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const actions = ACTIONS[statut] ?? [];
  if (actions.length === 0) return null;

  async function agir(nouveauStatut: string) {
    setLoading(nouveauStatut);
    try {
      const res = await fetch(`/api/commandes-en-ligne/${commandeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: nouveauStatut }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Erreur");
        return;
      }
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <button
          key={a.statut}
          onClick={() => agir(a.statut)}
          disabled={loading !== null}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 transition-colors ${a.cls}`}
        >
          {loading === a.statut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <a.icon className="h-3.5 w-3.5" />}
          {a.label}
        </button>
      ))}
    </div>
  );
}

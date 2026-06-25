"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Banknote } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";

interface Props {
  venteId: string;
  total: number;
  montantPaye: number; // déjà réglé
}

const MODES = [
  { value: "ESPECES", label: "Espèces" },
  { value: "CARTE", label: "Carte" },
  { value: "VIREMENT", label: "Virement" },
  { value: "CHEQUE", label: "Chèque" },
] as const;

// Accepte la virgule décimale (locale FR)
function parseMontant(s: string): number {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function RemboursementCreditButton({ venteId, total, montantPaye }: Props) {
  const router = useRouter();
  const reste = Math.max(0, total - montantPaye);

  const [open, setOpen] = useState(false);
  const [montantInput, setMontantInput] = useState(String(reste));
  const [modePaiement, setModePaiement] = useState<string>("ESPECES");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montant = parseMontant(montantInput);
  const valide = montant > 0 && montant <= reste;

  async function handle() {
    if (!valide) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/ventes/${venteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reglementCredit: { montant, modePaiement } }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Erreur serveur");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-5 border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold text-sm">Rembourser le crédit (paiement client)</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reste dû : <span className="font-bold text-foreground">{formatCurrency(reste)}</span>
            {montantPaye > 0 && <> · déjà réglé : {formatCurrency(montantPaye)}</>}
          </p>
        </div>
        {!open && (
          <button onClick={() => { setMontantInput(String(reste)); setOpen(true); }}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-bold hover:bg-emerald-700 active:scale-95 transition-all shadow-sm shrink-0">
            <Banknote className="h-4 w-4" />
            Enregistrer un paiement
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Montant payé</label>
              <input
                type="text" inputMode="decimal" value={montantInput}
                onChange={e => setMontantInput(e.target.value)}
                className="w-full h-9 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {montant > reste && <p className="text-xs text-destructive mt-1">Dépasse le reste dû ({formatCurrency(reste)})</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Mode de paiement</label>
              <select value={modePaiement} onChange={e => setModePaiement(e.target.value)}
                className="w-full h-9 rounded-lg border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          {valide && montant < reste && (
            <p className="text-xs text-amber-600">Paiement partiel — reste après : {formatCurrency(reste - montant)}</p>
          )}
          {valide && montant >= reste && (
            <p className="text-xs text-emerald-600">Ce paiement solde entièrement le crédit.</p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="flex-1 h-9 rounded-lg border text-sm hover:bg-muted transition-colors">Annuler</button>
            <button onClick={handle} disabled={loading || !valide}
              className="flex-1 h-9 rounded-lg bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
              Valider le paiement
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

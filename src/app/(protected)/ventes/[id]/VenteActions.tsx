"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Send, CheckCircle, XCircle, Clock, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Demande {
  id: string; type: string; motif: string; statut: string;
  reponse?: string | null; createdAt: string;
  demandeur: { nom: string; prenom: string };
}

interface Props {
  venteId:    string;
  statut:     string;
  canAnnuler: boolean; // SUPER_ADMIN
  isManager:  boolean;
  demandes:   Demande[];
}

const TYPE_LABELS: Record<string, string> = {
  ANNULATION: "Annulation", REMBOURSEMENT: "Remboursement", MODIFICATION: "Modification",
};

export function VenteActions({ venteId, statut, canAnnuler, isManager, demandes }: Props) {
  const router = useRouter();
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ type: "ANNULATION", motif: "" });
  const [reponses, setReponses] = useState<Record<string, string>>({});

  if (statut !== "COMPLETEE") return null;

  // ── SUPER_ADMIN ───────────────────────────────────────────────────────────
  async function handleAction(newStatut: "ANNULEE" | "REMBOURSEE") {
    if (!confirm(`Confirmer : ${newStatut.toLowerCase()} cette vente ? Stock restitué.`)) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/ventes/${venteId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: newStatut }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }

  async function handleApprobation(demandeId: string, statut: "APPROUVEE" | "REJETEE") {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/demandes/${demandeId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut, reponse: reponses[demandeId] ?? "" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }

  // ── MANAGER : demande ──────────────────────────────────────────────────────
  async function handleDemande(e: React.FormEvent) {
    e.preventDefault();
    if (!form.motif.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/demandes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venteId, type: form.type, motif: form.motif }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
      setShowForm(false); setForm({ type: "ANNULATION", motif: "" });
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }

  const demandesEnAttente = demandes.filter(d => d.statut === "EN_ATTENTE");
  const hasDemandeEnAttente = demandesEnAttente.length > 0;

  return (
    <div className="space-y-4">
      {/* ── Demandes existantes (SUPER_ADMIN voit tout, MANAGER voit les siennes) ── */}
      {demandes.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Send className="h-4 w-4 text-amber-500" />
            Demandes d&apos;approbation
          </h2>
          <div className="space-y-3">
            {demandes.map(d => (
              <div key={d.id} className={cn(
                "rounded-xl border p-4 text-sm space-y-2",
                d.statut === "EN_ATTENTE"  && "border-amber-200 bg-amber-50 dark:bg-amber-900/10",
                d.statut === "APPROUVEE"   && "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10",
                d.statut === "REJETEE"     && "border-red-200 bg-red-50 dark:bg-red-900/10",
              )}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-semibold">{TYPE_LABELS[d.type]} demandée</span>
                  <span className={cn("status-badge",
                    d.statut === "EN_ATTENTE" ? "status-badge-warning" :
                    d.statut === "APPROUVEE"  ? "status-badge-success" : "status-badge-danger"
                  )}>
                    {d.statut === "EN_ATTENTE" && <Clock className="h-3 w-3 inline mr-1" />}
                    {d.statut}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  Par {d.demandeur.prenom} {d.demandeur.nom} · {new Date(d.createdAt).toLocaleDateString("fr-FR")}
                </p>
                <p className="italic">&quot;{d.motif}&quot;</p>
                {d.reponse && (
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> Réponse : {d.reponse}
                  </p>
                )}

                {/* Boutons d'approbation pour SUPER_ADMIN */}
                {canAnnuler && d.statut === "EN_ATTENTE" && (
                  <div className="pt-2 space-y-2">
                    <textarea
                      value={reponses[d.id] ?? ""}
                      onChange={e => setReponses(r => ({ ...r, [d.id]: e.target.value }))}
                      placeholder="Réponse optionnelle..."
                      rows={2}
                      className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprobation(d.id, "APPROUVEE")}
                        disabled={loading}
                        className="flex-1 h-9 rounded-lg bg-emerald-600 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle className="h-4 w-4" /> Approuver
                      </button>
                      <button
                        onClick={() => handleApprobation(d.id, "REJETEE")}
                        disabled={loading}
                        className="flex-1 h-9 rounded-lg bg-red-600 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        <XCircle className="h-4 w-4" /> Rejeter
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* ── Zone SUPER_ADMIN : actions directes ── */}
      {canAnnuler && (
        <div className="card p-5 border-destructive/20">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Zone danger
          </h2>
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => handleAction("ANNULEE")} disabled={loading}
              className="btn-danger text-sm disabled:opacity-50 flex items-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Annuler la vente
            </button>
            <button onClick={() => handleAction("REMBOURSEE")} disabled={loading}
              className="btn-secondary text-sm border-orange-300 text-orange-700 hover:bg-orange-50 disabled:opacity-50 flex items-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Rembourser
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Restitue le stock et crée une écriture financière corrective.
          </p>
        </div>
      )}

      {/* ── Zone MANAGER : formulaire de demande ── */}
      {isManager && !hasDemandeEnAttente && (
        <div className="card p-5 border-amber-200 bg-amber-50/30 dark:bg-amber-900/5">
          <h2 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Send className="h-4 w-4 text-amber-600" />
            Demander une modification au Super Admin
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Toute modification de transaction doit être approuvée. Votre demande sera notifiée au Super Admin.
          </p>

          {!showForm ? (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 active:scale-95 transition-all">
              <Send className="h-4 w-4" /> Soumettre une demande
            </button>
          ) : (
            <form onSubmit={handleDemande} className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Type d&apos;action demandée</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full h-9 rounded-lg border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="ANNULATION">Annulation de la vente</option>
                  <option value="REMBOURSEMENT">Remboursement client</option>
                  <option value="MODIFICATION">Modification de la vente</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Motif <span className="text-destructive">*</span></label>
                <textarea
                  value={form.motif}
                  onChange={e => setForm(f => ({ ...f, motif: e.target.value }))}
                  required rows={3} maxLength={500}
                  placeholder="Expliquez clairement la raison de votre demande..."
                  className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground text-right mt-0.5">{form.motif.length}/500</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 h-9 rounded-lg border text-sm hover:bg-muted transition-colors">Annuler</button>
                <button type="submit" disabled={loading || !form.motif.trim()}
                  className="flex-1 h-9 rounded-lg bg-amber-500 text-white font-medium text-sm flex items-center justify-center gap-2 hover:bg-amber-600 disabled:opacity-50 transition-colors">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Envoyer la demande
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {isManager && hasDemandeEnAttente && (
        <div className="card p-4 border-amber-200 bg-amber-50/30 flex items-center gap-3">
          <Clock className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">
            Une demande est en attente d&apos;approbation pour cette vente.
          </p>
        </div>
      )}
    </div>
  );
}

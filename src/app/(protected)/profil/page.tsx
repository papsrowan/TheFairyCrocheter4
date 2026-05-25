"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { KeyRound, User, CheckCircle, AlertCircle, Loader2, ShieldCheck } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Administrateur",
  MANAGER:     "Manager",
  CAISSIER:    "Caissier",
  DISTRIBUTEUR:"Distributeur",
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-violet-100 text-violet-700",
  MANAGER:     "bg-blue-100 text-blue-700",
  CAISSIER:    "bg-emerald-100 text-emerald-700",
  DISTRIBUTEUR:"bg-amber-100 text-amber-700",
};

export default function ProfilPage() {
  const { data: session } = useSession();
  const user = session?.user;

  const [form, setForm]     = useState({ ancien: "", nouveau: "", confirmation: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(false);

    if (form.nouveau !== form.confirmation) {
      setError("Les deux nouveaux mots de passe ne correspondent pas"); return;
    }
    if (form.nouveau.length < 8) {
      setError("Le nouveau mot de passe doit faire au moins 8 caractères"); return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/profil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ancienMotDePasse: form.ancien, nouveauMotDePasse: form.nouveau }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Erreur serveur");
      setSuccess(true);
      setForm({ ancien: "", nouveau: "", confirmation: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mon profil</h1>
        <p className="text-sm text-muted-foreground mt-1">Informations de votre compte</p>
      </div>

      {/* Infos utilisateur */}
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-lg truncate">
              {user?.prenom ? `${user.prenom} ` : ""}{user?.nom ?? "—"}
            </p>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            <span className={`inline-flex items-center gap-1.5 mt-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_COLORS[user?.role ?? ""] ?? "bg-gray-100 text-gray-700"}`}>
              <ShieldCheck className="h-3 w-3" />
              {ROLE_LABELS[user?.role ?? ""] ?? user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Changer mot de passe */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-5">
          <KeyRound className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Changer le mot de passe</h2>
        </div>

        {success && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Mot de passe modifié avec succès
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { id: "ancien",        label: "Mot de passe actuel",      field: "ancien"        },
            { id: "nouveau",       label: "Nouveau mot de passe",     field: "nouveau"       },
            { id: "confirmation",  label: "Confirmer le nouveau",     field: "confirmation"  },
          ].map(({ id, label, field }) => (
            <div key={id}>
              <label htmlFor={id} className="block text-sm font-medium mb-1.5">{label}</label>
              <input
                id={id}
                type="password"
                value={form[field as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                required
                className="w-full h-10 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ))}

          <button type="submit" disabled={loading}
            className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Enregistrer le nouveau mot de passe
          </button>
        </form>
      </div>
    </div>
  );
}

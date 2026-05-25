"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreVertical, Loader2, Pencil, Trash2, PowerOff } from "lucide-react";

type UserData = {
  id: string; nom: string; prenom: string; email: string;
  role: string; actif: boolean;
};

/* ── Menu actions sur un utilisateur ── */
function UserMenu({ user }: { user: UserData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ nom: user.nom, prenom: user.prenom, role: user.role, password: "" });

  async function handlePatch(data: Partial<typeof form> & { actif?: boolean }) {
    setLoading(true);
    await fetch(`/api/utilisateurs/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setLoading(false);
    setOpen(false);
    setEditing(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Supprimer ${user.prenom} ${user.nom} ? Cette action est irréversible.`)) return;
    setLoading(true);
    await fetch(`/api/utilisateurs/${user.id}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  if (editing) {
    return (
      <form
        onSubmit={(e) => { e.preventDefault(); handlePatch(form); }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={(e) => e.target === e.currentTarget && setEditing(false)}
      >
        <div className="card p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
          <h3 className="font-semibold">Modifier l&apos;utilisateur</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Prénom</label>
              <input className="form-input" value={form.prenom} onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Nom</label>
              <input className="form-input" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="form-label">Rôle</label>
            <select className="form-select" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="MANAGER">Gérante</option>
              <option value="CAISSIER">Caissier</option>
              <option value="DISTRIBUTEUR">Distributeur</option>
            </select>
          </div>
          <div>
            <label className="form-label">Nouveau mot de passe <span className="text-muted-foreground">(laisser vide = inchangé)</span></label>
            <input type="password" className="form-input" placeholder="••••••••" value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setEditing(false)} className="btn-ghost">Annuler</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-44 card shadow-lg py-1">
            <button onClick={() => { setOpen(false); setEditing(true); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors">
              <Pencil className="h-3.5 w-3.5" /> Modifier
            </button>
            <button onClick={() => { setOpen(false); handlePatch({ actif: !user.actif }); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors">
              <PowerOff className="h-3.5 w-3.5" /> {user.actif ? "Désactiver" : "Activer"}
            </button>
            <hr className="my-1 border-border" />
            <button onClick={() => { setOpen(false); handleDelete(); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="h-3.5 w-3.5" /> Supprimer
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Bouton + formulaire création ── */
export function UtilisateurActions({ user }: { user?: UserData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ nom: "", prenom: "", email: "", password: "", role: "CAISSIER" });

  if (user) return <UserMenu user={user} />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/utilisateurs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Erreur");
      return;
    }
    setOpen(false);
    setForm({ nom: "", prenom: "", email: "", password: "", role: "CAISSIER" });
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="h-4 w-4" /> Nouvel utilisateur
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold">Nouvel utilisateur</h3>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Prénom</label>
            <input required className="form-input" value={form.prenom} onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">Nom</label>
            <input required className="form-input" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="form-label">Email</label>
          <input type="email" required className="form-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div>
          <label className="form-label">Mot de passe</label>
          <input type="password" required minLength={8} className="form-input" value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min. 8 caractères" />
        </div>
        <div>
          <label className="form-label">Rôle</label>
          <select className="form-select" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="MANAGER">Gérante</option>
            <option value="CAISSIER">Caissier</option>
            <option value="DISTRIBUTEUR">Distributeur</option>
          </select>
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Annuler</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Créer
          </button>
        </div>
      </form>
    </div>
  );
}

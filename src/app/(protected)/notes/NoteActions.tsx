"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";

/* ── Bouton suppression ── */
export function NoteActions({ noteId, isDelete }: { noteId?: string; isDelete?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ contenu: "", entityType: "general" });
  const [saving, setSaving] = useState(false);

  if (isDelete && noteId) {
    async function handleDelete() {
      if (!confirm("Supprimer cette note ?")) return;
      setLoading(true);
      await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
      setLoading(false);
      router.refresh();
    }
    return (
      <button
        onClick={handleDelete}
        disabled={loading}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground
                   hover:text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </button>
    );
  }

  /* ── Formulaire création ── */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.contenu.trim()) return;
    setSaving(true);
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contenu: form.contenu, entityType: form.entityType, entityId: "general" }),
    });
    setSaving(false);
    setForm({ contenu: "", entityType: "general" });
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="h-4 w-4" /> Nouvelle note
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3 w-full max-w-md">
      <h3 className="font-semibold text-sm">Nouvelle note</h3>
      <div>
        <label className="form-label">Catégorie</label>
        <select
          value={form.entityType}
          onChange={(e) => setForm((f) => ({ ...f, entityType: e.target.value }))}
          className="form-select"
        >
          <option value="general">Général</option>
          <option value="client">Client</option>
          <option value="produit">Produit</option>
          <option value="vente">Vente</option>
        </select>
      </div>
      <div>
        <label className="form-label">Contenu</label>
        <textarea
          required
          value={form.contenu}
          onChange={(e) => setForm((f) => ({ ...f, contenu: e.target.value }))}
          className="form-textarea"
          placeholder="Saisir votre note..."
          rows={4}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost" disabled={saving}>Annuler</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Enregistrer
        </button>
      </div>
    </form>
  );
}

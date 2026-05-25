"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";

export function DepenseForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ montant: "", description: "", date: "" });
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/finances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          montant: parseFloat(form.montant),
          description: form.description,
          date: form.date || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Erreur");
      }
      setForm({ montant: "", description: "", date: "" });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2">
        <Plus className="h-4 w-4" />
        Ajouter une dépense
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border rounded-lg p-4 bg-card space-y-3 w-full max-w-md"
    >
      <h3 className="font-semibold">Nouvelle dépense</h3>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">Montant (XAF)</label>
          <input
            type="number"
            min="1"
            step="1"
            required
            value={form.montant}
            onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))}
            className="form-input"
            placeholder="5000"
          />
        </div>
        <div>
          <label className="form-label">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className="form-input"
          />
        </div>
      </div>

      <div>
        <label className="form-label">Description</label>
        <input
          type="text"
          required
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="form-input"
          placeholder="Achat fournitures..."
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-ghost"
          disabled={loading}
        >
          Annuler
        </button>
        <button type="submit" className="btn-primary flex items-center gap-2" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Enregistrer
        </button>
      </div>
    </form>
  );
}

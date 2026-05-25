"use client";

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT NotesSection — Notes internes sur un client
// Affiche les notes existantes + formulaire d'ajout + suppression
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { Role } from "@prisma/client";
import { hasMinRole } from "@/lib/security/rbac";

interface NoteRow {
  id:        string;
  contenu:   string;
  createdAt: string; // ISO string
  auteur:    { id: string; nom: string; prenom: string };
}

interface Props {
  clientId:        string;
  notes:           NoteRow[];
  currentUserId:   string;
  currentUserRole: Role;
  canCreate:       boolean;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day:    "2-digit",
    month:  "short",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function NotesSection({
  clientId,
  notes: initialNotes,
  currentUserId,
  currentUserRole,
  canCreate,
}: Props) {
  const [notes,   setNotes]   = useState(initialNotes);
  const [contenu, setContenu] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const canDeleteAny = hasMinRole(currentUserRole, "MANAGER");

  async function handleAjouter(e: React.FormEvent) {
    e.preventDefault();
    if (!contenu.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/clients/${clientId}/notes`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ contenu: contenu.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur");
      }

      const note: NoteRow = await res.json();
      setNotes((prev) => [note, ...prev]);
      setContenu("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function handleSupprimer(noteId: string) {
    if (!confirm("Supprimer cette note ?")) return;

    try {
      const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur");
      }
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Formulaire d'ajout ───────────────────────────────────────── */}
      {canCreate && (
        <form onSubmit={handleAjouter} className="space-y-3">
          <textarea
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            placeholder="Ajouter une note interne..."
            rows={3}
            maxLength={2000}
            className="pos-input w-full resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{contenu.length}/2000 caractères</span>
            <button
              type="submit"
              disabled={loading || !contenu.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Ajout..." : "Ajouter la note"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* ── Liste des notes ──────────────────────────────────────────── */}
      {notes.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">
          Aucune note pour ce client
        </p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const isAuteur   = note.auteur.id === currentUserId;
            const peutSuppr  = isAuteur || canDeleteAny;

            return (
              <div
                key={note.id}
                className="p-4 bg-gray-50 rounded-lg border border-gray-100 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap flex-1">{note.contenu}</p>
                  {peutSuppr && (
                    <button
                      onClick={() => handleSupprimer(note.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-xs shrink-0"
                      title="Supprimer"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                  <span className="font-medium text-gray-500">
                    {note.auteur.prenom} {note.auteur.nom}
                  </span>
                  <span>·</span>
                  <span>{formatDate(note.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

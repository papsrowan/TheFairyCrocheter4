"use client";

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT ClientForm — Formulaire de création / édition d'un client
// mode="create" → POST /api/clients puis redirect /clients/[id]
// mode="edit"   → PATCH /api/clients/[id] puis router.refresh()
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Categorie {
  id:     string;
  nom:    string;
  remise: number;
}

interface DefaultValues {
  nom?:              string;
  prenom?:           string;
  email?:            string;
  telephone?:        string;
  adresse?:          string;
  codePostal?:       string;
  ville?:            string;
  categorieId?:      string;
  consentementRGPD?: boolean;
}

interface Props {
  mode:           "create" | "edit";
  clientId?:      string;
  defaultValues?: DefaultValues;
  categories:     Categorie[];
  canEdit?:       boolean;
}

export function ClientForm({ mode, clientId, defaultValues = {}, categories, canEdit = true }: Props) {
  const router = useRouter();

  const [nom,              setNom]              = useState(defaultValues.nom              ?? "");
  const [prenom,           setPrenom]           = useState(defaultValues.prenom           ?? "");
  const [email,            setEmail]            = useState(defaultValues.email            ?? "");
  const [telephone,        setTelephone]        = useState(defaultValues.telephone        ?? "");
  const [adresse,          setAdresse]          = useState(defaultValues.adresse          ?? "");
  const [codePostal,       setCodePostal]       = useState(defaultValues.codePostal       ?? "");
  const [ville,            setVille]            = useState(defaultValues.ville            ?? "");
  const [categorieId,      setCategorieId]      = useState(defaultValues.categorieId      ?? "");
  const [consentementRGPD, setConsentementRGPD] = useState(defaultValues.consentementRGPD ?? false);

  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);

  // Création catégorie inline
  const [nouvelleCat,     setNouvelleCat]     = useState("");
  const [remiseCat,       setRemiseCat]       = useState(0);
  const [ajoutCatOpen,    setAjoutCatOpen]    = useState(false);
  const [loadingCat,      setLoadingCat]      = useState(false);
  const [categoriesLocal, setCategoriesLocal] = useState(categories);

  async function handleAjouterCategorie() {
    if (!nouvelleCat.trim()) return;
    setLoadingCat(true);
    try {
      const res = await fetch("/api/categories-clients", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ nom: nouvelleCat.trim(), remise: remiseCat }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur création catégorie");
      }
      const cat: Categorie = await res.json();
      setCategoriesLocal((prev) => [...prev, cat].sort((a, b) => a.nom.localeCompare(b.nom)));
      setCategorieId(cat.id);
      setNouvelleCat("");
      setRemiseCat(0);
      setAjoutCatOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoadingCat(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;

    // Validation email côté client avant envoi
    const emailVal = email.trim();
    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      setError("L'adresse email n'est pas valide (ex: nom@domaine.fr)");
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      nom:             nom.trim(),
      ...(prenom.trim()    && { prenom:    prenom.trim() }),
      ...(emailVal         && { email:     emailVal }),
      ...(telephone.trim() && { telephone: telephone.trim() }),
      ...(adresse.trim()   && { adresse:   adresse.trim() }),
      ...(codePostal.trim()&& { codePostal:codePostal.trim() }),
      ...(ville.trim()     && { ville:     ville.trim() }),
      ...(categorieId      && { categorieId }),
      consentementRGPD,
    };

    try {
      const url    = mode === "create" ? "/api/clients" : `/api/clients/${clientId}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        // Extraire le premier message d'erreur de champ si disponible
        const details = data.details?.fieldErrors;
        const firstField = details && Object.keys(details)[0];
        const detail = firstField ? `${firstField} : ${details[firstField][0]}` : null;
        throw new Error(detail ?? data.error ?? "Erreur serveur");
      }

      if (mode === "create") {
        const client = await res.json();
        router.push(`/clients/${client.id}`);
      } else {
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      {/* ── Identité ─────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Identité</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
              disabled={!canEdit}
              placeholder="Dupont"
              className="pos-input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
            <input
              type="text"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              disabled={!canEdit}
              placeholder="Marie"
              className="pos-input w-full"
            />
          </div>
        </div>
      </div>

      {/* ── Contact ──────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Contact</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!canEdit}
              placeholder="marie.dupont@exemple.fr"
              className="pos-input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <input
              type="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              disabled={!canEdit}
              placeholder="06 12 34 56 78"
              className="pos-input w-full"
            />
          </div>
        </div>
      </div>

      {/* ── Adresse ──────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Adresse</h3>
        <div className="space-y-3">
          <input
            type="text"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            disabled={!canEdit}
            placeholder="12 rue des Artisans"
            className="pos-input w-full"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              value={codePostal}
              onChange={(e) => setCodePostal(e.target.value)}
              disabled={!canEdit}
              placeholder="75001"
              className="pos-input w-full"
              maxLength={10}
            />
            <input
              type="text"
              value={ville}
              onChange={(e) => setVille(e.target.value)}
              disabled={!canEdit}
              placeholder="Paris"
              className="pos-input w-full"
            />
          </div>
        </div>
      </div>

      {/* ── Catégorie + Remise ───────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Catégorie client</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <select
              value={categorieId}
              onChange={(e) => setCategorieId(e.target.value)}
              disabled={!canEdit}
              className="pos-input w-full"
            >
              <option value="">Sans catégorie</option>
              {categoriesLocal.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}{c.remise > 0 ? ` — remise ${c.remise}%` : ""}
                </option>
              ))}
            </select>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setAjoutCatOpen(!ajoutCatOpen)}
              className="px-3 py-2 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap"
            >
              + Créer
            </button>
          )}
        </div>

        {ajoutCatOpen && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-gray-600 mb-1">Nom de la catégorie</label>
              <input
                type="text"
                value={nouvelleCat}
                onChange={(e) => setNouvelleCat(e.target.value)}
                placeholder="VIP, Grossiste..."
                className="pos-input w-full text-sm"
              />
            </div>
            <div className="w-32">
              <label className="block text-xs text-gray-600 mb-1">Remise (%)</label>
              <input
                type="number"
                value={remiseCat}
                onChange={(e) => setRemiseCat(parseFloat(e.target.value) || 0)}
                min="0"
                max="100"
                step="0.5"
                className="pos-input w-full text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleAjouterCategorie}
              disabled={loadingCat || !nouvelleCat.trim()}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loadingCat ? "..." : "Ajouter"}
            </button>
          </div>
        )}
      </div>

      {/* ── Consentement RGPD ────────────────────────────────────────── */}
      <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consentementRGPD}
            onChange={(e) => setConsentementRGPD(e.target.checked)}
            disabled={!canEdit}
            className="mt-0.5 rounded text-indigo-600"
          />
          <div>
            <p className="text-sm font-medium text-gray-800">Consentement RGPD</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Le client a consenti à l&apos;enregistrement et au traitement de ses données personnelles
              conformément au RGPD.
            </p>
          </div>
        </label>
      </div>

      {/* ── Erreur / succès ──────────────────────────────────────────── */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="px-4 py-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
          Client mis à jour avec succès.
        </div>
      )}

      {/* ── Bouton ───────────────────────────────────────────────────── */}
      {canEdit && (
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading || !nom.trim()}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading
              ? "Enregistrement..."
              : mode === "create"
              ? "Créer le client"
              : "Enregistrer les modifications"}
          </button>
        </div>
      )}
    </form>
  );
}

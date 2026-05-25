// ─────────────────────────────────────────────────────────────────────────────
// SANITIZATION — Protection XSS
// Nettoie les chaînes avant affichage dans le DOM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Échappe les caractères HTML dangereux pour prévenir les XSS
 * À utiliser quand on insère du contenu dans du HTML brut (dangerouslySetInnerHTML)
 * En React, le rendu JSX est automatiquement sécurisé — cette fonction est
 * un filet de sécurité supplémentaire pour les cas edge
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Supprime les balises HTML d'une chaîne
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/**
 * Nettoie un nom de fichier pour éviter les path traversal
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.\.+/g, ".")
    .slice(0, 255);
}

/**
 * Valide qu'une URL est relative ou appartient au domaine autorisé
 * Prévient les redirections vers des sites malveillants
 */
export function isSafeRedirectUrl(url: string, baseUrl: string): boolean {
  if (url.startsWith("/")) return true; // URL relative = sûre
  try {
    const parsed = new URL(url);
    const base = new URL(baseUrl);
    return parsed.hostname === base.hostname;
  } catch {
    return false;
  }
}

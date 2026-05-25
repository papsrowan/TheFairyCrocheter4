// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMITING — Protection contre les abus sur les endpoints critiques
// Implémentation in-memory pour VPS Hostinger (pas de Redis requis)
// ─────────────────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Store en mémoire (suffisant pour un VPS unique)
const store = new Map<string, RateLimitEntry>();

// Nettoyage périodique du store (toutes les 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitOptions {
  max: number;       // Nombre max de requêtes
  windowMs: number;  // Fenêtre en millisecondes
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Vérifie et incrémente le compteur de rate limit pour une clé donnée
 * @param key - Identifiant unique (ex: IP + endpoint)
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // Nouvelle fenêtre
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + options.windowMs,
    };
    store.set(key, newEntry);
    return { success: true, remaining: options.max - 1, resetAt: newEntry.resetAt };
  }

  if (entry.count >= options.max) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    success: true,
    remaining: options.max - entry.count,
    resetAt: entry.resetAt,
  };
}

// Configurations prédéfinies par endpoint
export const RATE_LIMITS = {
  auth: {
    max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 10,
    windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW) || 15 * 60 * 1000,
  },
  api: {
    max: Number(process.env.RATE_LIMIT_API_MAX) || 100,
    windowMs: Number(process.env.RATE_LIMIT_API_WINDOW) || 60 * 1000,
  },
  ventes: {
    max: 50,
    windowMs: 60 * 1000,
  },
} as const;

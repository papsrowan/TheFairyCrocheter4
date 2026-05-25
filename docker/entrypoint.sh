#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# entrypoint.sh — Script de démarrage du container Next.js
# Exécute les migrations Prisma puis lance l'application
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "🚀 TheFairyCrocheter — Démarrage..."
echo "📅 $(date)"
echo "🌍 NODE_ENV: $NODE_ENV"

# ── Attendre la DB + synchroniser le schema Prisma (retry) ───────────────────
echo "⏳ Attente de la base et synchronisation du schema Prisma..."

MAX_RETRIES=30
RETRY_COUNT=0

PRISMA_CMD="node node_modules/prisma/build/index.js"

until $PRISMA_CMD db push > /tmp/prisma-push.log 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ Impossible de synchroniser le schema apres $MAX_RETRIES tentatives."
    echo "----- prisma db push output -----"
    cat /tmp/prisma-push.log
    echo "---------------------------------------"
    exit 1
  fi
  echo "🔄 Tentative $RETRY_COUNT/$MAX_RETRIES — Nouvel essai dans 3s..."
  sleep 3
done

echo "✅ Schema Prisma synchronise avec succes !"

# ── Initialiser le volume uploads (premier démarrage ou volume vide) ─────────
# Le volume Docker monte /app/public/uploads et écrase les fichiers de l'image.
# Si le dossier est vide, on copie les images livrées avec l'image (uploads.seed).
UPLOADS_DIR="/app/public/uploads/produits"
SEED_DIR="/app/public/uploads.seed"
if [ -d "$SEED_DIR" ] && [ -z "$(ls -A $UPLOADS_DIR 2>/dev/null)" ]; then
  echo "📁 Volume uploads vide — copie des images initiales..."
  cp -r "$SEED_DIR/." /app/public/uploads/ 2>/dev/null || true
  echo "✅ Images initiales restaurees"
fi

# ── Seed automatique idempotent (optionnel) ──────────────────────────────────
# AUTO_SEED=true (defaut) -> lance l'initialisation des donnees de base.
# Le script utilise des upserts, donc il ne duplique pas les donnees.
if [ "${AUTO_SEED:-true}" = "true" ]; then
  echo "🌱 Initialisation des donnees (seed idempotent)..."
  if [ -f prisma/seed.runtime.mjs ]; then
    node prisma/seed.runtime.mjs || echo "⚠️  Seed script not found or failed, continuing..."
  else
    echo "⚠️  prisma/seed.runtime.mjs not found, skipping seed"
  fi
  echo "✅ Seed execute"
else
  echo "⏭️  Seed saute (AUTO_SEED=${AUTO_SEED})"
fi

# ── Démarrer l'application ────────────────────────────────────────────────────
echo "▶️  Démarrage de Next.js sur le port $PORT..."
exec "$@"

# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile — TheFairyCrocheter (Next.js 14 + Prisma + TypeScript)
# Build multi-stage : deps → builder → runner
# Optimisé pour production avec sécurité et performance
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1 : Dépendances ────────────────────────────────────────────────────
FROM node:20-alpine AS deps

# Installer les libs natives nécessaires (Prisma, sharp, bcrypt)
RUN apk add --no-cache libc6-compat openssl python3 make g++

WORKDIR /app

# Copier uniquement les fichiers de dépendances pour profiter du cache Docker
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Installer toutes les dépendances (prod + dev nécessaires au build)
RUN npm ci --frozen-lockfile

# Générer le client Prisma
RUN npx prisma generate

# ── Stage 2 : Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat openssl python3 make g++

WORKDIR /app

# Copier les dépendances depuis l'étape précédente
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copier le code source
COPY . .

# Variables d'environnement nécessaires au build Next.js
# (valeurs factices — les vraies sont injectées au runtime)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV SKIP_ENV_VALIDATION=1

# Build de l'application (sortie en mode standalone)
RUN npm run build

# ── Stage 3 : Runner (image finale légère) ───────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat openssl curl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Créer un utilisateur non-root pour la sécurité (meilleure pratique)
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copier les fichiers publics
COPY --from=builder /app/public ./public

# Sauvegarder les uploads existants pour pouvoir initialiser le volume au 1er démarrage
# Le volume Docker écrase le dossier — on garde une copie "seed" dans l'image
RUN cp -r /app/public/uploads /app/public/uploads.seed 2>/dev/null || mkdir -p /app/public/uploads.seed/produits

# Créer le dossier uploads et .next/cache avec les bonnes permissions
RUN mkdir -p /app/public/uploads/produits .next/cache \
    && chown -R nextjs:nodejs /app/public/uploads /app/public/uploads.seed .next/cache

# Copier le build Next.js (mode standalone — réduit la taille finale)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copier Prisma (client généré + schema pour les migrations)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=deps    --chown=nextjs:nodejs /app/prisma ./prisma
# CLI prisma (nécessaire pour `prisma migrate deploy` au démarrage)
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# Copier le script d'entrée
COPY --chown=nextjs:nodejs docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Dossier de stockage des documents PDF générés
RUN mkdir -p /app/documents /app/logs && chown -R nextjs:nodejs /app/documents /app/logs

# Passer à l'utilisateur non-root
USER nextjs

EXPOSE 3000

# Health check pour orchestrateurs (Docker Compose, Kubernetes, etc.)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]

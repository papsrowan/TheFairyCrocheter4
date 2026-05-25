# Déploiement VPS — TheFairyCrocheter avec Docker Compose

Guide complet pour déployer l'application sur un VPS Linux avec Docker Compose.

---

## 📋 Table des matières

1. [Prérequis VPS](#-prérequis-vps)
2. [Installation Docker](#-installer-docker)
3. [Récupération du projet](#-récupération-du-projet)
4. [Configuration environnement](#-variables-denvironnement)
5. [Premier démarrage](#-premier-démarrage)
6. [Vérification](#-vérification)
7. [Mise à jour](#-mise-à-jour-applicative)
8. [Commandes utiles](#-commandes-utiles)
9. [Nginx Reverse Proxy (optionnel)](#-nginx-reverse-proxy-optionnel)
10. [Sauvegardes](#-sauvegardes)

---

## 🔧 Prérequis VPS

- **OS**: Ubuntu 20.04+ ou Debian 11+
- **RAM**: Minimum 2 GB (recommandé 4 GB)
- **Disque**: 20 GB minimum
- **Docker**: v24.0+
- **Docker Compose**: v2.20+
- **Git**: installé

### Ports ouverts à prévoir

```
22      → SSH (administration)
80      → HTTP (Nginx reverse proxy)
443     → HTTPS/SSL (Nginx reverse proxy)
3001    → Application Next.js (direct, si pas Nginx)
5432    → PostgreSQL (JAMAIS exposé publiquement)
```

---

## 📦 Installer Docker

### Sur Ubuntu/Debian

```bash
# 1. Ajouter le dépôt Docker officiel
curl -fsSL https://get.docker.com | sudo bash

# 2. Ajouter l'utilisateur courant au groupe docker (sans sudo)
sudo usermod -aG docker $USER

# 3. Appliquer les changements de groupe
newgrp docker

# 4. Vérifier l'installation
docker --version
docker compose version
```

### Alternative avec apt (Ubuntu 22.04+)

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
newgrp docker
```

---

## 📂 Récupération du projet

```bash
# 1. Créer le dossier de déploiement
sudo mkdir -p /opt/fairy-crocheter
sudo chown $USER:$USER /opt/fairy-crocheter

# 2. Naviguer et cloner le repo
cd /opt/fairy-crocheter
git clone <URL_DU_REPO> .
# ou si le repo est privé
git clone git@github.com:<USER>/<REPO>.git .

# 3. Créer un dossier pour les backups
mkdir -p backups/database backups/documents
```

---

## ⚙️ Variables d'environnement

### Fichier `.env.production`

Le `docker-compose.yml` crée automatiquement:
- Une base de données PostgreSQL interne (`service: db`)
- Les connexions réseau entre services

Créer le fichier de configuration:

```bash
cd /opt/fairy-crocheter
cp .env.example .env.production
nano .env.production
```

### Exemple `.env.production`

```env
# ─────────────────────────────────────────────────────────────────
# Base de données PostgreSQL
# ─────────────────────────────────────────────────────────────────
POSTGRES_DB=fairycrocheter
POSTGRES_USER=postgres
POSTGRES_PASSWORD=ChangeThisToStrongPassword123!

# ─────────────────────────────────────────────────────────────────
# Application Next.js
# ─────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# URLs publiques (remplacer par ton domaine ou IP VPS)
NEXTAUTH_URL=https://crocheter.example.com
NEXT_PUBLIC_APP_URL=https://crocheter.example.com

# Secrets d'authentification (générer avec: openssl rand -base64 32)
NEXTAUTH_SECRET=GenerateWithOpensslRandBase6432
AUTH_SECRET=GenerateWithOpensslRandBase6432

# SSE Secret (pour Server-Sent Events)
SSE_SECRET=GenerateWithOpensslRandBase6432

# ─────────────────────────────────────────────────────────────────
# Configuration de démarrage
# ─────────────────────────────────────────────────────────────────
AUTO_SEED=true
SKIP_ENV_VALIDATION=0

# ─────────────────────────────────────────────────────────────────
# Port d'exposition sur l'hôte VPS
# ─────────────────────────────────────────────────────────────────
APP_PORT=3001
```

### Générer des secrets cryptographiquement sûrs

```bash
# Générer 3 secrets forts pour remplacer les valeurs
openssl rand -base64 32
openssl rand -base64 32
openssl rand -base64 32

# Copier les valeurs dans .env.production
```

> ⚠️ **IMPORTANT**: Ne JAMAIS committer `.env.production` dans Git! Il est dans `.gitignore`.

---

## 🚀 Premier démarrage

### Build et lancement des services

```bash
cd /opt/fairy-crocheter

# 1. Builder l'image et démarrer les services en arrière-plan
docker compose up -d --build

# 2. Vérifier le statut
docker compose ps

# 3. Voir les logs en direct (Ctrl+C pour arrêter)
docker compose logs -f app

# 4. Ou seulement les logs récents
docker compose logs app --tail=50
```

### Ce qui se passe lors du premier démarrage

```
1. ✅ Image PostgreSQL téléchargée/lancée
2. ✅ Base de données créée
3. ✅ Health check PostgreSQL validé
4. ✅ Image Next.js buildée (multi-stage)
5. ✅ Container app démarré
6. ✅ Schema Prisma synchronisé (prisma db push)
7. ✅ Seed de données optionnel (AUTO_SEED=true)
8. ✅ Application écoute sur le port 3000 (mappé vers 3001 sur l'hôte)
9. ✅ Health check validé
```

---

## ✅ Vérification

### Tester l'application

```bash
# Test simple via curl
curl -f http://localhost:3001/api/health
# Réponse attendue: {"status":"ok"} ou similaire

# Ou dans un navigateur
http://VPS_IP:3001
# ou si configuré avec Nginx
https://crocheter.example.com
```

### Visualiser les logs

```bash
# Logs de l'app en direct
docker compose logs -f app

# Logs de la base de données
docker compose logs -f db

# Voir toutes les entrées
docker compose logs -f
```

### Vérifier les volumes

```bash
# Voir l'espace utilisé
docker system df

# Inspecter un volume
docker volume inspect fairy-crocheter_db-data
docker volume inspect fairy-crocheter_app-documents
```

---

## 🔄 Mise à jour applicative

### Processus de mise à jour (zéro downtime possible)

```bash
cd /opt/fairy-crocheter

# 1. Récupérer les derniers changements
git pull

# 2. Rebuild l'image avec le nouveau code
docker compose up -d --build

# 3. Vérifier que les migrations se sont bien faites
docker compose logs app | grep -E "(✅|❌)"

# 4. Nettoyer les anciennes images Docker (optionnel)
docker image prune -f
```

### Rollback rapide (en cas de problème)

```bash
# Revert le dernier commit Git
git reset --hard HEAD~1

# Rebuild l'image précédente
docker compose up -d --build

# Vérifier
docker compose logs app --tail=20
```

---

## 📊 Commandes utiles

### Gestion des services

```bash
# Afficher l'état
docker compose ps

# Arrêter proprement
docker compose down

# Redémarrer un service spécifique
docker compose restart app
docker compose restart db

# Rebuild sans redémarrer
docker compose build --no-cache

# Forcer une reconstruction complète et restart
docker compose down
docker compose up -d --build

# Accès shell dans le container app
docker compose exec app sh

# Accès à la base de données
docker compose exec db psql -U postgres -d fairycrocheter
```

### Logs et debug

```bash
# Logs en direct avec filtre
docker compose logs -f app --tail=100

# Voir les variables d'environnement du container
docker compose exec app env | grep -E "^(NODE_|DATABASE_|AUTH_)"

# Tester la connectivité à la DB
docker compose exec app node -e "
  const { PrismaClient } = require('@prisma/client');
  new PrismaClient().\$queryRaw\`SELECT 1\`.then(()=>console.log('✅ DB OK')).catch(e=>console.log('❌',e.message));
"
```

### Nettoyage

```bash
# Supprimer les containers arrêtés
docker compose rm

# Supprimer les volumes (⚠️ DONNÉES PERDUES)
docker compose down -v

# Nettoyer les images inutilisées
docker image prune -f

# Nettoyer tout (containers, images, volumes)
docker system prune -a
```

---

## 🌐 Nginx Reverse Proxy (optionnel)

Si tu veux exposer l'app via un domaine avec SSL/TLS, utiliser Nginx en reverse proxy.

### Installation Nginx + Certbot (Let's Encrypt)

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx

# Démarrer Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Obtenir un certificat Let's Encrypt
sudo certbot certonly --standalone \
  -d crocheter.example.com \
  -d www.crocheter.example.com \
  --email admin@example.com \
  --agree-tos
```

### Configuration Nginx

```bash
sudo nano /etc/nginx/sites-available/fairy-crocheter
```

Contenu:

```nginx
server {
    listen 80;
    server_name crocheter.example.com www.crocheter.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name crocheter.example.com www.crocheter.example.com;

    ssl_certificate /etc/letsencrypt/live/crocheter.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crocheter.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activer la config:

```bash
sudo ln -s /etc/nginx/sites-available/fairy-crocheter \
           /etc/nginx/sites-enabled/fairy-crocheter

sudo nginx -t  # Valider la syntaxe
sudo systemctl reload nginx
```

---

## 💾 Sauvegardes

### Backup de la base de données

```bash
# Backup complet
docker compose exec db pg_dump -U postgres fairycrocheter \
  | gzip > /opt/fairy-crocheter/backups/database/dump-$(date +%Y%m%d-%H%M%S).sql.gz

# Backup automatisé (cron job)
# Ajouter dans crontab (crontab -e):
0 2 * * * cd /opt/fairy-crocheter && \
  docker compose exec db pg_dump -U postgres fairycrocheter | \
  gzip > backups/database/dump-$(date +\%Y\%m\%d-\%H\%M\%S).sql.gz && \
  find backups/database -name "dump-*.sql.gz" -mtime +7 -delete
```

### Backup des fichiers générés (documents, uploads)

```bash
# Backup manuel
tar -czf /opt/fairy-crocheter/backups/documents/docs-$(date +%Y%m%d).tar.gz \
  /opt/fairy-crocheter/documents/ /opt/fairy-crocheter/public/uploads/

# Cleanup anciens backups (garder 30 jours)
find /opt/fairy-crocheter/backups -name "*.tar.gz" -mtime +30 -delete
```

### Restore depuis un backup

```bash
# Restore de la base
zcat backups/database/dump-20240503-140000.sql.gz | \
  docker compose exec -T db psql -U postgres fairycrocheter

# Restore des documents
tar -xzf backups/documents/docs-20240503.tar.gz -C /
```

---

## 🔐 Sécurité

- ✅ Utilisateur non-root dans le container
- ✅ PostgreSQL NON exposé publiquement
- ✅ Secrets forts dans `.env.production`
- ✅ Nginx reverse proxy avec SSL/TLS
- ✅ Health checks automatiques
- ✅ Redémarrages automatiques (`restart: unless-stopped`)

---

## 📞 Troubleshooting

### L'app refuse de se connecter à la DB

```bash
# Vérifier la health de la DB
docker compose ps

# Voir les logs de la DB
docker compose logs db

# Vérifier la variable DATABASE_URL dans l'app
docker compose exec app env | grep DATABASE_URL
```

### Port 3001 déjà utilisé

```bash
# Trouver le processus
sudo lsof -i :3001

# Changer le port dans .env.production
APP_PORT=3002

# Redémarrer
docker compose down
docker compose up -d
```

### La migration Prisma échoue

```bash
# Voir l'erreur complète
docker compose logs app | tail -100

# Forcer une migration manuelle
docker compose exec app npx prisma migrate resolve --rolled-back migration_name

# Redémarrer l'app
docker compose restart app
```

### Espace disque faible

```bash
# Voir l'usage
docker system df

# Nettoyer les anciens logs
docker compose exec app sh -c 'find /app/logs -mtime +7 -delete'

# Nettoyer Docker
docker system prune -a --volumes
```

---

**Bonne chance avec votre déploiement! 🚀**

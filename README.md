# The Fairy Crocheter — ERP / POS v1.0.0

Application de gestion commerciale complète pour boutique de crochet.

**Stack** : Next.js 14 App Router · TypeScript · PostgreSQL · Prisma 5 · NextAuth v5 (Auth.js) · Tailwind CSS · Zustand · TanStack Query v5

---

## Modules

| Module | Route | État |
|---|---|---|
| Authentification JWT + RBAC | `/login` | ✅ |
| Dashboard temps réel (SSE) | `/dashboard` | ✅ |
| Caisse POS (scan caméra + douchette, offline) | `/ventes/nouvelle` | ✅ |
| Ventes (historique, détails, annulation) | `/ventes` | ✅ |
| Produits + Stock (EAN-13, alertes) | `/produits` | ✅ |
| Clients & CRM | `/clients` | ✅ |
| Finances / Comptabilité | `/finances` | ✅ |
| Documents PDF (A4 + ticket 80mm) | `/api/documents/*` | ✅ |
| Reçu HTML imprimable | `/documents/recu/[id]` | ✅ |
| Notes internes | `/notes` | ✅ |
| Gestion utilisateurs | `/utilisateurs` | ✅ |
| Mon profil (changement mdp) | `/profil` | ✅ |
| Demandes d'approbation (MANAGER → SUPER_ADMIN) | API `/api/demandes` | ✅ |
| Mode hors-ligne IndexedDB + sync | automatique | ✅ |

---

## Rôles

| Rôle | Accès |
|---|---|
| `SUPER_ADMIN` | Tout — modification ventes, finances, utilisateurs, approbations |
| `MANAGER` | Ventes (lecture + création), produits (lecture), clients (création + vérification doublon), notes propres, demandes d'approbation |
| `CAISSIER` | Ventes + clients (création) + documents |
| `DISTRIBUTEUR` | Catalogue produits (lecture) |

**MANAGER — restrictions clés :**
- Annulation/modification vente → demande d'approbation au SUPER_ADMIN
- Fiche client détaillée interdite (vérification doublon seulement)
- Pas d'accès : Finances, Utilisateurs, Paramètres, stock ajustement
- Notes visibles : les siennes uniquement

---

## Caisse POS

1. `/ventes/nouvelle` — bouton **Scanner caméra** (ZXing, EAN-13/CODE128) ou recherche texte
2. Panier multi-produits avec **prix de gros automatique par paliers** (ex : ≥20u → 700 XAF/u, reste → 1000 XAF/u)
3. Créer client inline sans quitter la caisse
4. Aperçu ticket / facture avant confirmation
5. Post-vente : reçu HTML imprimable, ticket PDF 80mm, facture PDF A4

---

## Documents

| Document | Route | Format |
|---|---|---|
| Reçu HTML | `/documents/recu/[id]` | 80mm, barcodes JS |
| Ticket PDF | `/api/documents/ticket/[id]` | 80mm, barcodes canvas |
| Facture PDF | `/api/documents/facture/[id]` | A4, barcodes canvas |

Logo : `public/TFC0.png` — inclus dans tous les documents.

---

## Installation

```bash
npm install
npx prisma generate
npx prisma db push        # ou migrate dev (nécessite droits CREATE DATABASE)
npm run dev
```

**`.env` requis :**
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/fairycrocheter
AUTH_SECRET=<secret_32_chars>
AUTH_URL=http://localhost:3000
```

**Créer le SUPER_ADMIN initial :**
```bash
node -e "
const {PrismaClient}=require('@prisma/client');
const bcrypt=require('bcryptjs');
const p=new PrismaClient();
bcrypt.hash('MotDePasse',12).then(h=>p.user.create({data:{email:'admin@example.com',passwordHash:h,nom:'Nom',prenom:'Prénom',role:'SUPER_ADMIN',actif:true}})).then(u=>console.log('OK',u.email)).finally(()=>p.\$disconnect());
"
```

**Partage réseau (ngrok) :**
```env
# .env.local uniquement
NEXTAUTH_URL=https://xxxx.ngrok-free.app
NEXTAUTH_URL_INTERNAL=http://localhost:3000
```

---

## Structure clé

```
src/
  app/
    (auth)/login/          # LoginForm + page
    (protected)/
      dashboard/           # SSE + stats + horloge manager
      ventes/nouvelle/     # CaisseView + CartSummary + ProductSearch
      ventes/[id]/         # Détail + VenteActions + VenteEditModal + VenteActionsWrapper
      produits/            # Liste + [id] + nouveau
      clients/             # Liste + [id] (SUPER_ADMIN only)
      finances/            # Dashboard comptable
      profil/              # Changement mot de passe
  api/
    ventes/                # GET list + POST create + PATCH statut + PUT modification
    demandes/              # GET + POST (MANAGER) + PATCH approve/reject (SUPER_ADMIN)
    documents/             # facture/[id] + ticket/[id] + recu/[id]
    profil/                # PATCH password
  components/
    ventes/                # CartSummary, ProductSearch, CameraScanner, ApercuModal
    produits/              # ProduitForm, StockAjustementModal
    clients/               # VentesHistoriqueTable (filtres complets)
    dashboard/             # DashboardStats, VentesChart, HorlogeNumerique
    layout/                # Sidebar, MobileBottomNav (safe-area iPhone)
  lib/
    pdf/                   # factureTemplate, ticketTemplate, barcodeCanvas (EAN-13 + CODE128)
    security/              # rbac.ts (permissions), audit.ts
    realtime/              # SSE server-sent events
  stores/
    cartStore.ts           # Zustand — panier avec prix gros par paliers
    offlineStore.ts        # Queue offline IndexedDB
  types/index.ts           # SSEEventType, Session augmentation
```

---

## Notes techniques

- **PDF** : `@react-pdf/renderer` dans `serverComponentsExternalPackages` (WASM yoga-layout)
- **Scanner caméra** : `@zxing/browser` + `@zxing/library`, dynamic import SSR:false
- **Prix de gros** : calcul par groupes — `floor(qté/seuil)×seuil×prixGros + reste×prixBase`
- **Responsive** : bottom nav mobile 5 items + sheet "Plus", safe-area iPhone, tabs caisse
- **Auth** : JWT stateless, `AUTH_SECRET` + `AUTH_URL`, password min 8 chars
- **DB push** : utiliser `prisma db push` si l'utilisateur DB n'a pas le droit `CREATE DATABASE`

---

## Devise

Toutes les sommes : **XAF** (Franc CFA)

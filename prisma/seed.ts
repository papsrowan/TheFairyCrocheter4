// ─────────────────────────────────────────────────────────────────────────────
// SEED — Données initiales pour démarrer l'application
// Crée le compte Super Admin et les données de base
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log(" Démarrage du seed...");

  // ─── Super Admin ───────────────────────────────────────────────────────────
  const adminPasswordHash = await hash("Arielle@2026!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "arielle.bell@fairycrocheter.com" },
    update: { nom: "Bell", prenom: "Arielle" },
    create: {
      email: "arielle.bell@fairycrocheter.com",
      passwordHash: adminPasswordHash,
      nom: "Bell",
      prenom: "Arielle",
      role: "SUPER_ADMIN",
      actif: true,
    },
  });
  console.log(`✅ Super Admin créé : ${admin.email}`);

  // ─── Paramètres entreprise ─────────────────────────────────────────────────
  await prisma.entreprise.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      nom: "Mon Entreprise",
      adresse: "123 Rue du Commerce",
      codePostal: "75001",
      ville: "Paris",
      tauxTVADefaut: 20.0,
      email: "contact@monentreprise.fr",
    },
  });
  console.log("✅ Paramètres entreprise créés");

  // ─── Catégories de produits ────────────────────────────────────────────────
  const categories = ["Accessoires", "Multi Color", "Uni Color"];
  for (const nom of categories) {
    await prisma.categorie.upsert({
      where: { nom },
      update: {},
      create: { nom },
    });
  }
  console.log("✅ Catégories produits créées");

  // ─── Catégories clients ────────────────────────────────────────────────────
  const categoriesClients = [
    { nom: "Standard",      remise: 0  },
    { nom: "Fidele",        remise: 5  },
    { nom: "VIP",           remise: 10 },
    { nom: "Professionnel", remise: 15 },
  ];
  for (const cat of categoriesClients) {
    await prisma.categorieClient.upsert({
      where: { nom: cat.nom },
      update: {},
      create: cat,
    });
  }
  console.log("✅ Catégories clients créées");

  console.log("\n🎉 Seed terminé !");
  console.log("─────────────────────────────────────────");
  console.log("Connexion admin :");
  console.log("  Email    : arielle.bell@fairycrocheter.com");
  console.log("  Password : Arielle@2026!");
  console.log("─────────────────────────────────────────");
  console.log("⚠️  Changez le mot de passe en production !");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seed runtime: initialisation des donnees de base...");

  const adminPasswordHash = await bcrypt.hash("Arielle@2026!", 12);

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
  console.log(`✅ Admin pret: ${admin.email}`);

  await prisma.entreprise.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      nom: "The Fairy Crocheter",
      adresse: "123 Rue du Commerce",
      codePostal: "75001",
      ville: "Paris",
      tauxTVADefaut: 20.0,
      email: "contact@thefairycrocheter.fr",
    },
  });

  // Supprimer toutes les catégories inutiles
  await prisma.categorie.deleteMany({
    where: { nom: { notIn: ["Uni Color", "Multi Color", "Accessoires"] } },
  }).catch(() => { });

  const categories = ["Uni Color", "Multi Color", "Accessoires"];
  for (const nom of categories) {
    await prisma.categorie.upsert({
      where: { nom },
      update: {},
      create: { nom },
    });
  }

  const categoriesClients = [
    { nom: "Standard", remise: 0 },
    { nom: "Fidele", remise: 5 },
    { nom: "VIP", remise: 10 },
    { nom: "Professionnel", remise: 15 },
  ];
  for (const cat of categoriesClients) {
    await prisma.categorieClient.upsert({
      where: { nom: cat.nom },
      update: {},
      create: cat,
    });
  }

  console.log("✅ Seed runtime termine (idempotent)");
  console.log("─────────────────────────────────────────");
  console.log("  Email    : arielle.bell@fairycrocheter.com");
  console.log("  Password : Arielle@2026!");
  console.log("─────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error("❌ Seed runtime en echec:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

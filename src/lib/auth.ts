// ─────────────────────────────────────────────────────────────────────────────
// AUTH.JS v5 — Configuration complète avec credentials + JWT + RBAC
// ─────────────────────────────────────────────────────────────────────────────

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";

// Schéma de validation des credentials
const credentialsSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Mot de passe trop court"),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Utiliser PrismaAdapter uniquement pour la lecture des users
  // Les sessions sont gérées en JWT (stateless, compatible VPS Hostinger)
  adapter: PrismaAdapter(prisma),

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 heures (journée de travail)
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        // Validation stricte côté serveur avec Zod
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          throw new Error("Identifiants invalides");
        }

        const { email, password } = parsed.data;

        // Récupération de l'utilisateur
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            nom: true,
            prenom: true,
            role: true,
            actif: true,
          },
        });

        if (!user || !user.actif) {
          throw new Error("Identifiants invalides");
        }

        // Vérification du mot de passe avec bcrypt
        const passwordValid = await compare(password, user.passwordHash);
        if (!passwordValid) {
          throw new Error("Identifiants invalides");
        }

        // Mise à jour lastLoginAt (non bloquant)
        prisma.user
          .update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })
          .catch(console.error);

        return {
          id: user.id,
          email: user.email,
          nom: user.nom,
          prenom: user.prenom,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // À la connexion : enrichir le token avec les données métier
      if (user) {
        token.id = user.id;
        token.nom = (user as { nom: string }).nom;
        token.prenom = (user as { prenom: string }).prenom;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },

    async session({ session, token }) {
      // Transmettre les données du token vers la session côté client
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.nom = token.nom as string;
        session.user.prenom = token.prenom as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },

  // Événements d'audit
  events: {
    async signIn({ user }) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "auth.signin",
          entityType: "user",
          entityId: user.id,
          details: { email: user.email },
        },
      });
    },
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      if (token?.id) {
        await prisma.auditLog.create({
          data: {
            userId: token.id as string,
            action: "auth.signout",
            entityType: "user",
            entityId: token.id as string,
          },
        });
      }
    },
  },
});

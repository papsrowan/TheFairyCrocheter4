// ─────────────────────────────────────────────────────────────────────────────
// AUTH EDGE — Configuration Auth.js SANS Prisma pour le middleware Next.js
//
// Le middleware tourne sur Edge Runtime → pas de Node.js natif → pas de Prisma.
// Cette config valide uniquement le JWT (lecture du token signé) sans
// toucher à la base de données. Toutes les infos nécessaires (id, role)
// sont déjà encodées dans le token lors de la connexion.
// ─────────────────────────────────────────────────────────────────────────────

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Role } from "@prisma/client";

export const { auth } = NextAuth({
  secret: process.env.AUTH_SECRET,

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  // Provider minimal — la vraie authentification se passe dans auth.ts
  // Ici on ne fait que valider le JWT existant
  providers: [
    Credentials({
      credentials: {},
      authorize: () => null, // Jamais appelé dans le middleware
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.nom = (user as { nom: string }).nom;
        token.prenom = (user as { prenom: string }).prenom;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.nom = token.nom as string;
        session.user.prenom = token.prenom as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
});

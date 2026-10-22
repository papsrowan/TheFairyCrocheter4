import { NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";

const secretKey = new TextEncoder().encode(
  process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "fallback_pos_secret_key_change_in_production"
);

export interface MobileSessionUser {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: Role;
}

export interface MobileSession {
  user: MobileSessionUser;
}

/**
 * Signe un JWT pour l'application mobile / terminal POS
 */
export async function signMobileToken(user: MobileSessionUser, expiresIn = "30d"): Promise<string> {
  return await new SignJWT({
    id: user.id,
    email: user.email,
    nom: user.nom,
    prenom: user.prenom,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);
}

/**
 * Vérifie un JWT émis pour l'application mobile
 */
export async function verifyMobileToken(token: string): Promise<MobileSessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (!payload.id || !payload.role) return null;
    return {
      id: payload.id as string,
      email: (payload.email as string) || "",
      nom: (payload.nom as string) || "",
      prenom: (payload.prenom as string) || "",
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

/**
 * Récupère l'utilisateur authentifié soit via le cookie NextAuth (web),
 * soit via le header `Authorization: Bearer <token>` (terminal mobile).
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<MobileSession | null> {
  // 1. Tenter la session web standard (NextAuth cookie)
  try {
    const session = await auth();
    if (session?.user?.id && session.user.role) {
      return {
        user: {
          id: session.user.id,
          email: session.user.email || "",
          nom: session.user.nom || "",
          prenom: session.user.prenom || "",
          role: session.user.role as Role,
        },
      };
    }
  } catch {
    // Si auth() échoue ou n'est pas applicable, continuer vers le Bearer
  }

  // 2. Tenter le jeton Bearer (Mobile / POS)
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const user = await verifyMobileToken(token);
      if (user) {
        return { user };
      }
    }
  }

  return null;
}

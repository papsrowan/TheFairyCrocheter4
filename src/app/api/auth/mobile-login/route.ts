// ─────────────────────────────────────────────────────────────────────────────
// API /api/auth/mobile-login — Authentification pour Terminal POS Mobile Flutter
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { signMobileToken } from "@/lib/auth-mobile";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { audit, AUDIT_ACTIONS } from "@/lib/security/audit";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email("Format d'email invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

export async function POST(req: NextRequest) {
  // Rate limiting pour prévenir les attaques brute force
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`mobile-login:${ip}`, RATE_LIMITS.auth);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Trop de tentatives. Veuillez patienter." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format JSON invalide" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Données invalides" },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

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
    return NextResponse.json(
      { error: "Identifiants invalides ou compte inactif" },
      { status: 401 }
    );
  }

  const passwordValid = await compare(password, user.passwordHash);
  if (!passwordValid) {
    return NextResponse.json(
      { error: "Identifiants invalides" },
      { status: 401 }
    );
  }

  // Vérifier le rôle autorisé pour la caisse
  const rolesAutorises: Role[] = ["CAISSIER", "MANAGER", "SUPER_ADMIN", "DISTRIBUTEUR"];
  if (!rolesAutorises.includes(user.role)) {
    return NextResponse.json(
      { error: "Rôle non autorisé pour utiliser le terminal de caisse" },
      { status: 403 }
    );
  }

  // Mettre à jour lastLogin
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: ip,
    },
  }).catch(() => null);

  // Journal d'audit
  await audit({
    userId: user.id,
    action: AUDIT_ACTIONS.AUTH_SIGNIN,
    entityType: "user",
    entityId: user.id,
    details: {
      client: "mobile_pos_terminal",
      email: user.email,
    },
  }).catch(() => null);

  const token = await signMobileToken({
    id: user.id,
    email: user.email,
    nom: user.nom,
    prenom: user.prenom,
    role: user.role,
  });

  return NextResponse.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      role: user.role,
    },
  });
}

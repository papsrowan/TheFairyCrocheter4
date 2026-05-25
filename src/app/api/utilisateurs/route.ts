import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { hash } from "bcryptjs";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "utilisateurs:read"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, nom: true, prenom: true, email: true,
      role: true, actif: true, lastLoginAt: true, createdAt: true,
    },
  });

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "utilisateurs:create"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const { nom, prenom, email, password, role } = body as Record<string, string>;
  if (!nom || !email || !password || !role)
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "Email déjà utilisé" }, { status: 409 });

  const passwordHash = await hash(password, 12);
  const user = await prisma.user.create({
    data: { nom, prenom: prenom ?? "", email, passwordHash, role: role as Role },
    select: { id: true, nom: true, prenom: true, email: true, role: true, actif: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { hash } from "bcryptjs";
import type { Role } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "utilisateurs:update"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const { nom, prenom, email, role, actif, password } = body as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if (nom !== undefined) data.nom = nom;
  if (prenom !== undefined) data.prenom = prenom;
  if (email !== undefined) data.email = email;
  if (role !== undefined) data.role = role;
  if (actif !== undefined) data.actif = actif;
  if (password && typeof password === "string" && password.length >= 6) {
    data.passwordHash = await hash(password, 12);
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, nom: true, prenom: true, email: true, role: true, actif: true },
  });

  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "utilisateurs:delete"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;

  if (id === session.user.id)
    return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte" }, { status: 400 });

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

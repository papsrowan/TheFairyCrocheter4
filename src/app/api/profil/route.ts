import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { compare, hash } from "bcryptjs";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let body: { ancienMotDePasse?: string; nouveauMotDePasse?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const { ancienMotDePasse, nouveauMotDePasse } = body;
  if (!ancienMotDePasse || !nouveauMotDePasse)
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 422 });
  if (nouveauMotDePasse.length < 8)
    return NextResponse.json({ error: "Le nouveau mot de passe doit faire au moins 8 caractères" }, { status: 422 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  const valide = await compare(ancienMotDePasse, user.passwordHash);
  if (!valide) return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 401 });

  const nouveauHash = await hash(nouveauMotDePasse, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: nouveauHash } });

  return NextResponse.json({ success: true });
}

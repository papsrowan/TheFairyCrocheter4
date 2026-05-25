// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/notes/[id] — Supprimer une note interne
// Autorisé : auteur de la note, MANAGER ou SUPER_ADMIN
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, hasMinRole } from "@/lib/security/rbac";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as Role;
  if (!hasPermission(role, "notes:delete")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const { id } = await params;
  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) return NextResponse.json({ error: "Note introuvable" }, { status: 404 });

  // Seul l'auteur ou un MANAGER+ peut supprimer
  const isAuteur  = note.userId === session.user.id;
  const isManager = hasMinRole(role, "MANAGER");

  if (!isAuteur && !isManager) {
    return NextResponse.json({ error: "Vous ne pouvez supprimer que vos propres notes" }, { status: 403 });
  }

  await prisma.note.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

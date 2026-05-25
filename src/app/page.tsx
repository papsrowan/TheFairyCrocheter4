// Redirection depuis la racine vers le dashboard (ou login si non authentifié)
// Le middleware gère la protection — ici on redirige simplement

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  redirect("/dashboard");
}

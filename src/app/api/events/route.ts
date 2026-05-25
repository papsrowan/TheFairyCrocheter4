// ─────────────────────────────────────────────────────────────────────────────
// SSE ENDPOINT — /api/events
// Les clients dashboard se connectent ici pour recevoir les mises à jour push
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSSEStream } from "@/lib/realtime/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Authentification requise pour les SSE
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Canal optionnel via query param (ex: ?channel=dashboard)
  const channel = req.nextUrl.searchParams.get("channel") ?? "global";

  const stream = createSSEStream(channel);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",  // Disable Nginx buffering
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

const MIME: Record<string, string> = {
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  webp: "image/webp",
  gif:  "image/gif",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const safeParts = params.path.map((p) => p.replace(/\.\./g, ""));
  const filePath  = join(process.cwd(), "public", "uploads", ...safeParts);

  try {
    const buffer = await readFile(filePath);
    const ext    = safeParts[safeParts.length - 1].split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(buffer, {
      headers: {
        "Content-Type":  MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

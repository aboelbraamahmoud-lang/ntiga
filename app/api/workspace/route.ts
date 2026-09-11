import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { workspaceStates } from "@/db/schema";

export const runtime = "edge";
const uid = (request: Request) => request.headers.get("oai-authenticated-user-id") ?? "local-preview";

export async function GET(request: Request) {
  try {
    const [row] = await (await getDb()).select().from(workspaceStates).where(eq(workspaceStates.userId, uid(request))).limit(1);
    return NextResponse.json({ workspace: row ? JSON.parse(row.payload) : null, updatedAt: row?.updatedAt });
  } catch {
    return NextResponse.json({ workspace: null, error: "storage_unavailable" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.text();
    if (body.length > 8_000_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
    const { workspace } = JSON.parse(body);
    if (!workspace || typeof workspace !== "object") return NextResponse.json({ error: "invalid" }, { status: 400 });
    const now = Date.now();
    await (await getDb()).insert(workspaceStates).values({ userId: uid(request), payload: JSON.stringify(workspace), updatedAt: now }).onConflictDoUpdate({ target: workspaceStates.userId, set: { payload: JSON.stringify(workspace), updatedAt: now } });
    return NextResponse.json({ saved: true, updatedAt: now });
  } catch {
    return NextResponse.json({ error: "save_failed" }, { status: 503 });
  }
}

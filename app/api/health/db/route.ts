import { query } from "@/src/lib/db";

export async function GET() {
  try {
    await query("SELECT 1");
    return Response.json({ ok: true, database: "connected" });
  } catch {
    return Response.json(
      { ok: false, database: "unavailable" },
      { status: 503 },
    );
  }
}

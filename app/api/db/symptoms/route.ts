import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/require-user";

export async function GET() {
  try {
    const userId = await requireUserId();
    const { data, error } = await getSupabase()
      .from("symptoms")
      .select("*")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data.map(row => ({
      id: row.id,
      symptom: row.symptom,
      severity: row.severity,
      notes: row.notes,
      loggedAt: row.logged_at,
    })));
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const s = await req.json();
    const { error } = await getSupabase().from("symptoms").upsert({
      id: s.id,
      user_id: userId,
      symptom: s.symptom,
      severity: s.severity,
      notes: s.notes || "",
      logged_at: s.loggedAt,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

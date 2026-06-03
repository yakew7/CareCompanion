import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/require-user";

export async function GET() {
  try {
    const userId = await requireUserId();
    const { data, error } = await getSupabase()
      .from("activity_log")
      .select("*")
      .eq("user_id", userId)
      .order("at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return NextResponse.json(data.map(row => ({
      type: row.type,
      label: row.label,
      at: row.at,
    })));
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const entry = await req.json();
    const { error } = await getSupabase().from("activity_log").insert({
      user_id: userId,
      type: entry.type,
      label: entry.label,
      at: entry.at,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

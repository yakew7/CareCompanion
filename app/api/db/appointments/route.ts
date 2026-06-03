import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/require-user";

export async function GET() {
  try {
    const userId = await requireUserId();
    const { data, error } = await getSupabase()
      .from("appointments")
      .select("*")
      .eq("user_id", userId)
      .order("datetime", { ascending: true });
    if (error) throw error;
    return NextResponse.json(data.map(row => ({
      id: row.id,
      doctor: row.doctor,
      specialty: row.specialty,
      datetime: row.datetime,
      location: row.location,
      notes: row.notes,
      status: row.status,
      postVisitNotes: row.post_visit_notes,
    })));
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const a = await req.json();
    const { error } = await getSupabase().from("appointments").upsert({
      id: a.id,
      user_id: userId,
      doctor: a.doctor,
      specialty: a.specialty || "",
      datetime: a.datetime,
      location: a.location || "",
      notes: a.notes || "",
      status: a.status || "upcoming",
      post_visit_notes: a.postVisitNotes || "",
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/require-user";

export async function GET() {
  try {
    const userId = await requireUserId();
    const { data, error } = await getSupabase()
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return NextResponse.json(data || null);
  } catch {
    return NextResponse.json(null);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await req.json();
    const { error } = await getSupabase().from("user_profiles").upsert({
      user_id: userId,
      name: body.name,
      patient_name: body.patientName,
      relation: body.relation,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const userId = await requireUserId();
    await getSupabase().from("user_profiles").delete().eq("user_id", userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

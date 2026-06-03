import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/require-user";

export async function GET() {
  try {
    const userId = await requireUserId();
    const { data, error } = await getSupabase()
      .from("medications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json(data.map(row => ({
      id: row.id,
      name: row.name,
      dosage: row.dosage,
      frequency: row.frequency,
      times: row.times,
      notes: row.notes,
      log: row.log,
    })));
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const med = await req.json();
    const { error } = await getSupabase().from("medications").upsert({
      id: med.id,
      user_id: userId,
      name: med.name,
      dosage: med.dosage || "",
      frequency: med.frequency || "Once daily",
      times: med.times || [],
      notes: med.notes || "",
      log: med.log || {},
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

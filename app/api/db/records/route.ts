import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/require-user";

export async function GET() {
  try {
    const userId = await requireUserId();
    const { data, error } = await getSupabase()
      .from("medical_records")
      .select("*")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data.map(row => ({
      id: row.id,
      name: row.name,
      text: row.text_content,
      summary: row.summary,
      uploadedAt: row.uploaded_at,
    })));
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const r = await req.json();
    const { error } = await getSupabase().from("medical_records").upsert({
      id: r.id,
      user_id: userId,
      name: r.name,
      text_content: r.text || "",
      summary: r.summary || "",
      uploaded_at: r.uploadedAt,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

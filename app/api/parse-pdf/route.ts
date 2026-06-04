// SERVER ONLY — do not import from client components
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const { extractText } = await import("unpdf");
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });

    return NextResponse.json({ text: text.slice(0, 15000) });
  } catch (err) {
    console.error("PDF parse error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to parse PDF: ${msg}` }, { status: 500 });
  }
}

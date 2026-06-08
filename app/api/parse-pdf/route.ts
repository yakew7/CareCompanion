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

    if (!text.trim()) {
      return NextResponse.json({
        error: "This PDF contains only scanned images — no text layer was found. Upload a text-based PDF, or run the document through OCR software first.",
      }, { status: 422 });
    }

    return NextResponse.json({ text: text.slice(0, 15000) });
  } catch (err) {
    console.error("PDF parse error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    let friendly: string;
    if (lower.includes("encrypt") || lower.includes("password") || lower.includes("protected")) {
      friendly = "This PDF is password-protected. Remove the password and try again.";
    } else if (lower.includes("invalid") || lower.includes("corrupt") || lower.includes("malformed")) {
      friendly = "This PDF appears to be corrupted or uses an unsupported format.";
    } else if (lower.includes("range") || lower.includes("unexpected end") || lower.includes("eof")) {
      friendly = "This PDF could not be read — it may be truncated or corrupted.";
    } else {
      friendly = `Failed to parse PDF: ${msg}`;
    }
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}

// SERVER ONLY — do not import from client components
// Explicitly set Node.js runtime so pdf-parse works on Vercel
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Import the inner lib directly to avoid pdf-parse loading test files at require time
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js" as any)).default;
    const data = await pdfParse(buffer);

    return NextResponse.json({ text: data.text.slice(0, 15000) });
  } catch (err) {
    console.error("PDF parse error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to parse PDF: ${msg}` }, { status: 500 });
  }
}

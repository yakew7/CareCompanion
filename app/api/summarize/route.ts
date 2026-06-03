// SERVER ONLY — do not import from client components
import { getGroq, MODEL } from "@/lib/groq";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = (body.text as string)?.slice(0, 12000);
    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const completion = await getGroq().chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a medical report interpreter for family caregivers with no medical background.

Respond using EXACTLY these three labeled sections. Each label must be on its own line followed by a colon. Do not skip any section.

SUMMARY:
Write 2-3 plain-English paragraphs covering everything in the report: diagnoses, test results, prescribed medications, reported symptoms, upcoming appointments, and anything the doctors are concerned about. Keep it simple — no medical jargon.

DIETARY:
Copy any food restrictions, diet advice, or nutrition instructions mentioned. If none are mentioned, write: None.

OTHER:
Copy any other instructions not already covered — bed rest, activity limits, wound care, follow-up tests, warning signs to watch for. If none, write: None.`,
        },
        { role: "user", content: text },
      ],
      max_tokens: 1400,
      temperature: 0.2,
    });

    const raw = completion.choices[0].message.content?.trim() || "";

    // Parse each section by splitting on the known headers
    const summaryMatch = raw.match(/SUMMARY:\s*([\s\S]*?)(?=\nDIETARY:|\nOTHER:|$)/i);
    const dietaryMatch = raw.match(/DIETARY:\s*([\s\S]*?)(?=\nSUMMARY:|\nOTHER:|$)/i);
    const otherMatch = raw.match(/OTHER:\s*([\s\S]*?)(?=\nSUMMARY:|\nDIETARY:|$)/i);

    const clean = (s: string | undefined) => {
      const v = s?.trim() || "";
      return v.toLowerCase() === "none" || v.toLowerCase() === "none." ? "" : v;
    };

    const summary = clean(summaryMatch?.[1]) || raw;
    const dietary = clean(dietaryMatch?.[1]);
    const other = clean(otherMatch?.[1]);

    return NextResponse.json({ summary, dietary, other });
  } catch {
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}

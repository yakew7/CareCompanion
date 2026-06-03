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

Respond using EXACTLY this format with these three section headers. Do not add any other text outside the sections.

SUMMARY:
Write 2-3 short paragraphs in plain English. Cover key findings, diagnoses, test results, and anything concerning. No medical jargon.

DIETARY:
List any food restrictions, diet advice, or nutrition instructions the doctor mentioned. If none are mentioned in the report, write: none

OTHER:
List any other important instructions not covered above — such as bed rest, activity restrictions, wound care, follow-up tests, or emergency warning signs. If none, write: none`,
        },
        { role: "user", content: text },
      ],
      max_tokens: 1200,
      temperature: 0.2,
    });

    const raw = completion.choices[0].message.content?.trim() || "";

    const extractSection = (label: string): string => {
      const pattern = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n[A-Z]+:|$)`, "i");
      const match = raw.match(pattern);
      const val = match?.[1]?.trim() || "";
      return val.toLowerCase() === "none" ? "" : val;
    };

    const summary = extractSection("SUMMARY");
    const dietary = extractSection("DIETARY");
    const other = extractSection("OTHER");

    // Fallback: if parsing fails, treat whole response as summary
    return NextResponse.json({
      summary: summary || raw,
      dietary,
      other,
    });
  } catch {
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}

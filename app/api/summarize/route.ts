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

Analyse the report and return ONLY valid JSON in exactly this shape:
{
  "summary": "Plain-English overview of the report. 2-3 short paragraphs. Cover key findings, test results, diagnoses, and any concerns. No jargon.",
  "dietary": "Any food restrictions, dietary advice, or nutritional instructions the doctor mentioned. If none are mentioned, return empty string.",
  "other": "Any other important instructions that are not medications, appointments, or dietary — for example: bed rest, wound care, activity restrictions, follow-up tests, lifestyle changes. If none, return empty string."
}

Rules:
- Return ONLY the JSON object, no extra text before or after.
- If a section has nothing relevant, use empty string "".
- Keep language simple and direct. Avoid em dashes and filler phrases.`,
        },
        { role: "user", content: text },
      ],
      max_tokens: 1200,
      temperature: 0,
    });

    const raw = completion.choices[0].message.content?.trim() || "{}";
    let parsed: { summary?: string; dietary?: string; other?: string } = {};
    try {
      parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}");
    } catch {
      // fallback: treat the whole response as summary
      parsed = { summary: raw, dietary: "", other: "" };
    }

    return NextResponse.json({
      summary: parsed.summary || "",
      dietary: parsed.dietary || "",
      other: parsed.other || "",
    });
  } catch {
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}

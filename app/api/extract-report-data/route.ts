// SERVER ONLY
import { NextRequest, NextResponse } from "next/server";
import { getGroq, MODEL } from "@/lib/groq";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text?.trim()) return NextResponse.json({ medications: [], appointments: [], symptoms: [] });

    const completion = await getGroq().chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a medical data extractor. Extract ONLY explicitly mentioned items from the report — do NOT infer or assume anything not directly stated.

Return ONLY valid JSON in this exact format:
{
  "medications": [
    { "name": "string", "dosage": "string or empty", "frequency": "string or empty", "notes": "string or empty" }
  ],
  "appointments": [
    { "doctor": "string or empty", "specialty": "string or empty", "notes": "string describing what was said, e.g. follow up in 3 months" }
  ],
  "symptoms": [
    { "symptom": "string", "severity": 1-5, "notes": "exact phrase from report" }
  ]
}

Severity mapping (only if explicitly described):
1-2 = mild/slight/minor, 3 = moderate, 4 = significant/concerning, 5 = severe/critical

If nothing is found for a category, return an empty array.
Do NOT add anything that is not directly written in the report.`,
        },
        {
          role: "user",
          content: `Extract medications, appointments, and symptoms from this report:\n\n${text.slice(0, 12000)}`,
        },
      ],
      max_tokens: 1500,
      temperature: 0,
    });

    const raw = completion.choices[0].message.content?.trim() || "";
    const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}");

    return NextResponse.json({
      medications: json.medications || [],
      appointments: json.appointments || [],
      symptoms: json.symptoms || [],
    });
  } catch {
    return NextResponse.json({ medications: [], appointments: [], symptoms: [] });
  }
}

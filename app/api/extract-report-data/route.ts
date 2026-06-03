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
          content: `You are a strict medical data extractor. Extract ONLY items that are EXPLICITLY and DIRECTLY stated in the report text.

STRICT RULES:
- Medications: ONLY include if a medication NAME is explicitly prescribed or listed. dosage/frequency/times must be EXACTLY as written — if times of day are not mentioned, leave "times" as an empty array []. Do NOT infer or guess times.
- Appointments: ONLY include if a specific follow-up visit is explicitly recommended (e.g. "follow up in 3 months", "return in 6 weeks"). Do NOT create appointments for every doctor mentioned. If no follow-up is mentioned, return [].
- Symptoms: ONLY include symptoms the patient is explicitly described as experiencing or reporting. Do NOT include test results or diagnoses as symptoms.
- If something is NOT directly stated, do NOT include it.

Return ONLY valid JSON:
{
  "medications": [
    {
      "name": "exact name from report",
      "dosage": "exact dosage or empty string",
      "frequency": "exact frequency as written or empty string",
      "times": ["Morning"|"Afternoon"|"Evening"|"Night"] only if EXPLICITLY stated, otherwise [],
      "notes": "any extra instructions mentioned"
    }
  ],
  "appointments": [
    {
      "doctor": "doctor name if mentioned or empty string",
      "specialty": "specialty if mentioned or empty string",
      "notes": "exact follow-up instruction as written in report",
      "daysFromNow": number only if timeframe is clearly stated (e.g. 90 for 3 months, 180 for 6 months, 14 for 2 weeks), else 30
    }
  ],
  "symptoms": [
    {
      "symptom": "symptom name",
      "severity": 1-5 only if severity words used (mild=2, moderate=3, significant=4, severe=5), else 3,
      "notes": "exact phrase from report describing this symptom"
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Extract from this report — only what is explicitly stated:\n\n${text.slice(0, 12000)}`,
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

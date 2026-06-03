// SERVER ONLY
import { NextRequest, NextResponse } from "next/server";
import { getGroq, MODEL } from "@/lib/groq";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text?.trim()) return NextResponse.json({ medications: [], appointments: [], symptoms: [], dietary: [], other: [] });

    const completion = await getGroq().chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a strict medical data extractor. Extract ONLY items that are EXPLICITLY and DIRECTLY stated in the report text.

STRICT RULES:
- Medications: ONLY if a medication name is explicitly prescribed or listed. dosage/frequency/times must be exactly as written. If times of day are not mentioned, use []. Do NOT infer or guess.
- Appointments: ONLY if a specific follow-up visit is explicitly recommended. Do NOT create appointments for every doctor mentioned.
- Symptoms: ONLY symptoms the patient is explicitly described as experiencing. Do NOT include test results or diagnoses as symptoms.
- Dietary: ONLY explicit dietary instructions (e.g. "avoid salt", "low-fat diet", "drink 2L water daily"). Not general health advice.
- Other: Other explicit instructions not covered above (e.g. "bed rest for 1 week", "avoid heavy lifting", "monitor blood pressure daily").
- If something is NOT directly stated, do NOT include it.

Return ONLY valid JSON:
{
  "medications": [{ "name": "...", "dosage": "...", "frequency": "...", "times": [], "notes": "..." }],
  "appointments": [{ "doctor": "...", "specialty": "...", "notes": "...", "daysFromNow": 30 }],
  "symptoms": [{ "symptom": "...", "severity": 3, "notes": "..." }],
  "dietary": [{ "advice": "exact dietary instruction from report" }],
  "other": [{ "note": "exact other instruction from report" }]
}`,
        },
        {
          role: "user",
          content: `Extract from this report — only what is explicitly stated:\n\n${text.slice(0, 12000)}`,
        },
      ],
      max_tokens: 1800,
      temperature: 0,
    });

    const raw = completion.choices[0].message.content?.trim() || "";
    const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}");

    return NextResponse.json({
      medications: json.medications || [],
      appointments: json.appointments || [],
      symptoms: json.symptoms || [],
      dietary: json.dietary || [],
      other: json.other || [],
    });
  } catch {
    return NextResponse.json({ medications: [], appointments: [], symptoms: [], dietary: [], other: [] });
  }
}

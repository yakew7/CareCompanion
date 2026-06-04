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

INDIAN PRESCRIPTION NOTATION — 1-0-1 style:
These numbers mean tablets at Morning - Afternoon/Noon - Night (3 slots), or Morning - Afternoon - Evening - Night (4 slots).
Map each position to the time name if the value is 1 (include it) or 0 (skip it):
  3-slot:  1-0-1 → ["Morning","Night"]   |  1-1-1 → ["Morning","Afternoon","Night"]
           1-0-0 → ["Morning"]           |  0-0-1 → ["Night"]
           0-1-0 → ["Afternoon"]         |  1-1-0 → ["Morning","Afternoon"]
           0-1-1 → ["Afternoon","Night"]
  4-slot:  1-0-0-1 → ["Morning","Night"] |  1-1-1-1 → ["Morning","Afternoon","Evening","Night"]
           1-0-1-0 → ["Morning","Evening"]| 1-0-1-1 → ["Morning","Evening","Night"]
If the notation has numbers > 1 (e.g. "2-0-2"), that is the tablet count per dose — set dosage accordingly but still map times the same way.

PATIENT PROFILE — extract if mentioned in the report:
- Age in years (integer)
- Height in cm (convert from feet/inches if needed, e.g. 5'7" ≈ 170 cm)
- Gender: "male", "female", or "other"
- Blood type if stated (e.g. "B+", "O−")
Only include fields that are EXPLICITLY stated. Omit the rest.

VITAL SIGNS & LAB VALUES — extract any of the following if EXPLICITLY present with a numeric value:
- Blood Pressure → type "bp", value=systolic (number), value2=diastolic (number), unit="mmHg"
- Blood Glucose / Blood Sugar → type "glucose", unit="mg/dL" (convert from mmol/L if needed: ×18)
- SpO₂ / Oxygen Saturation → type "spo2", unit="%"
- Heart Rate / Pulse → type "heart_rate", unit="bpm"
- Temperature → type "temperature", unit="°C" (convert from °F: (F−32)×5/9)
- Respiratory Rate → type "respiratory_rate", unit="breaths/min"
- HbA1c / Glycated Haemoglobin → type "hba1c", unit="%"
- Total Cholesterol → type "cholesterol", unit="mg/dL", notes="LDL: X mg/dL · HDL: Y mg/dL · TG: Z mg/dL" (include breakdown if present)
- Haemoglobin → type "hemoglobin", unit="g/dL"
- Creatinine → type "creatinine", unit="mg/dL"
Do NOT invent values. Only include what is explicitly stated with a number.

DURATION — extract if stated:
  "for 3 days", "× 3", "x3 days", "3 days", "3/7" → durationDays: 3
  "for 1 week" → durationDays: 7  |  "for 2 weeks" → durationDays: 14
  If no duration mentioned, omit durationDays or use 0.

Return ONLY valid JSON:
{
  "medications": [{ "name": "...", "dosage": "...", "frequency": "...", "times": [], "notes": "...", "durationDays": 0 }],
  "appointments": [{ "doctor": "...", "specialty": "...", "notes": "...", "daysFromNow": 30 }],
  "symptoms": [{ "symptom": "...", "severity": 3, "notes": "..." }],
  "dietary": [{ "advice": "exact dietary instruction from report" }],
  "other": [{ "note": "exact other instruction from report" }],
  "vitals": [{ "type": "bp", "value": 120, "value2": 80, "unit": "mmHg", "notes": "" }],
  "profile": { "age": null, "heightCm": null, "gender": null, "bloodType": null }
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
      vitals: json.vitals || [],
      profile: json.profile || {},
    });
  } catch {
    return NextResponse.json({ medications: [], appointments: [], symptoms: [], dietary: [], other: [] });
  }
}

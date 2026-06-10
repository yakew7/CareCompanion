// SERVER ONLY
import { NextRequest, NextResponse } from "next/server";
import { getGroq, MODEL } from "@/lib/groq";
import { guardAiRoute } from "@/lib/api-guard";

export async function POST(req: NextRequest) {
  const rejected = await guardAiRoute();
  if (rejected) return rejected;
  try {
    const { text } = await req.json();
    if (!text?.trim()) return NextResponse.json({ medications: [], appointments: [], symptoms: [], dietary: [], other: [], vitals: [], profile: {} });
    const todayStr = new Date().toISOString().split("T")[0];

    const extractionMessages = [
        {
          role: "system" as const,
          content: `You are a strict medical data extractor. Extract ONLY items that are EXPLICITLY and DIRECTLY stated in the report text.

STRICT RULES:
- Medications: ONLY if a medication name is explicitly prescribed or listed. dosage/frequency/times must be exactly as written. If times of day are not mentioned, use []. Do NOT infer or guess.
- Appointments: ONLY if a specific follow-up visit is explicitly recommended. Do NOT create appointments for every doctor mentioned. If an explicit date is stated, return it as dateISO (YYYY-MM-DD); if a time is stated, return timeHHMM (24-hour, e.g. "10:00"). Also set daysFromNow = days from TODAY (${todayStr}) to that date.
- Symptoms: ONLY symptoms the patient is explicitly described as experiencing. Do NOT include test results or diagnoses as symptoms. If a specific date is mentioned for a symptom, set daysAgo to how many days before TODAY (${todayStr}) that date was. If no date is mentioned, use daysAgo: 0.
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

Core vitals:
- Blood Pressure → type "bp", value=systolic, value2=diastolic, unit="mmHg"
- Blood Glucose / Blood Sugar / FBS / PPBS / RBS → type "glucose", unit="mg/dL" (convert from mmol/L ×18)
- SpO₂ / Oxygen Saturation → type "spo2", unit="%"
- Heart Rate / Pulse → type "heart_rate", unit="bpm"
- Temperature → type "temperature", unit="°C" (convert from °F: (F−32)×5/9)
- Respiratory Rate → type "respiratory_rate", unit="breaths/min"
- Weight / Body Weight → type "weight", unit="kg" (convert from lbs: lbs × 0.453592)

Metabolic:
- HbA1c / Glycated Haemoglobin → type "hba1c", unit="%"
- Total Cholesterol → type "cholesterol", unit="mg/dL", notes="LDL: X mg/dL · HDL: Y mg/dL · TG: Z mg/dL" (include breakdown if present)

Blood Panel (CBC):
- Haemoglobin / Hb → type "hemoglobin", unit="g/dL"
- WBC / Leucocytes / TLC / Total WBC → type "wbc", unit="×10³/µL" (if given as cells/µL divide by 1000; if given as ×10³ keep as-is)
- RBC / Red Blood Cells / Red Cell Count → type "rbc", unit="×10⁶/µL" (if given as cells/µL divide by 1000000)
- Platelets / Thrombocytes / PLT → type "platelets", unit="×10³/µL" (if given as cells/µL divide by 1000; if given as Lakh/µL multiply by 100)

Liver (LFT):
- ALT / SGPT / Alanine Aminotransferase → type "alt", unit="U/L"
- AST / SGOT / Aspartate Aminotransferase → type "ast", unit="U/L"
- ALP / Alkaline Phosphatase → type "alp", unit="U/L"
- Total Bilirubin / Serum Bilirubin → type "bilirubin", unit="mg/dL"
- Albumin / Serum Albumin → type "albumin", unit="g/dL"

Kidney / Renal:
- Creatinine / Serum Creatinine → type "creatinine", unit="mg/dL"
- BUN / Blood Urea Nitrogen / Blood Urea / Urea → type "bun", unit="mg/dL"
- Uric Acid / Serum Uric Acid → type "uric_acid", unit="mg/dL"
- eGFR / Estimated GFR / Creatinine Clearance → type "egfr", unit="mL/min"

Thyroid (TFT):
- TSH / Thyroid Stimulating Hormone → type "tsh", unit="mIU/L"
- T3 / Total T3 / Triiodothyronine → type "t3", unit="ng/dL"
- T4 / Total T4 / Thyroxine → type "t4", unit="µg/dL"

Electrolytes:
- Sodium / Na / Serum Sodium → type "sodium", unit="mEq/L"
- Potassium / K / Serum Potassium → type "potassium", unit="mEq/L"
- Calcium / Ca / Serum Calcium → type "calcium", unit="mg/dL"

Iron Studies:
- Serum Iron / Iron → type "serum_iron", unit="µg/dL"
- Ferritin / Serum Ferritin → type "ferritin", unit="ng/mL"

Do NOT invent values. Only include what is explicitly stated with a number.

DURATION — extract if stated:
  "for 3 days", "× 3", "x3 days", "3 days", "3/7" → durationDays: 3
  "for 1 week" → durationDays: 7  |  "for 2 weeks" → durationDays: 14
  If no duration mentioned, omit durationDays or use 0.

Return ONLY valid JSON:
{
  "medications": [{ "name": "...", "dosage": "...", "frequency": "...", "times": [], "notes": "...", "durationDays": 0 }],
  "appointments": [{ "doctor": "...", "specialty": "...", "notes": "...", "daysFromNow": 30, "dateISO": "YYYY-MM-DD or omit", "timeHHMM": "HH:MM or omit", "location": "venue if stated, else omit" }],
  "symptoms": [{ "symptom": "...", "severity": 3, "notes": "...", "daysAgo": 0 }],
  "dietary": [{ "advice": "exact dietary instruction from report" }],
  "other": [{ "note": "exact other instruction from report" }],
  "vitals": [{ "type": "bp", "value": 120, "value2": 80, "unit": "mmHg", "notes": "" }],
  "profile": { "age": null, "heightCm": null, "gender": null, "bloodType": null }
}`,
        },
        {
          role: "user" as const,
          content: `Extract from this report — only what is explicitly stated:\n\n${text.slice(0, 12000)}`,
        },
      ];

    // A truncated response silently loses whatever comes last in the JSON
    // (usually the lab vitals) — retry once if the model ran out of tokens
    // or returned unparseable JSON.
    let json: Record<string, unknown> = {};
    for (let attempt = 0; attempt < 2; attempt++) {
      const completion = await getGroq().chat.completions.create({
        model: MODEL,
        messages: extractionMessages,
        max_tokens: 8000,
        temperature: 0,
      });
      const choice = completion.choices[0];
      const raw = choice.message.content?.trim() || "";
      try {
        json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}");
      } catch {
        json = {};
      }
      if (choice.finish_reason !== "length" && Object.keys(json).length > 0) break;
    }

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
    return NextResponse.json({ medications: [], appointments: [], symptoms: [], dietary: [], other: [], vitals: [], profile: {} });
  }
}

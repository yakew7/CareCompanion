import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { requireUserId } from "@/lib/require-user";

export async function POST() {
  try {
    const userId = await requireUserId();
    const db = getSupabase();
    const now = new Date();

    const med = (d: number) => { const dt = new Date(now); dt.setDate(dt.getDate() - d); return dt.toISOString(); };

    await db.from("medications").upsert([
      { id: "demo-med-1", user_id: userId, name: "Metformin", dosage: "500mg", frequency: "Twice daily", times: ["Morning", "Evening"], notes: "Take with food", log: {} },
      { id: "demo-med-2", user_id: userId, name: "Amlodipine", dosage: "5mg", frequency: "Once daily", times: ["Morning"], notes: "Blood pressure medication", log: {} },
      { id: "demo-med-3", user_id: userId, name: "Vitamin D3", dosage: "1000 IU", frequency: "Once daily", times: ["Morning"], notes: "", log: {} },
    ]);

    await db.from("symptoms").upsert([
      { id: "demo-sym-1", user_id: userId, symptom: "Headache", severity: 3, notes: "Came on after lunch", logged_at: med(1) },
      { id: "demo-sym-2", user_id: userId, symptom: "Fatigue", severity: 2, notes: "Feeling tired in the afternoon", logged_at: med(2) },
      { id: "demo-sym-3", user_id: userId, symptom: "Chest tightness", severity: 4, notes: "Lasted about 10 minutes", logged_at: med(4) },
      { id: "demo-sym-4", user_id: userId, symptom: "Headache", severity: 2, notes: "", logged_at: med(6) },
      { id: "demo-sym-5", user_id: userId, symptom: "Shortness of breath", severity: 3, notes: "While climbing stairs", logged_at: med(8) },
    ]);

    const futureDate = new Date(now); futureDate.setDate(futureDate.getDate() + 5);
    const pastDate = new Date(now); pastDate.setDate(pastDate.getDate() - 10);

    await db.from("appointments").upsert([
      { id: "demo-appt-1", user_id: userId, doctor: "Dr. Meera Sharma", specialty: "Cardiologist", datetime: futureDate.toISOString(), location: "Apollo Hospital, Mumbai", notes: "Bring last 3 months of BP readings", status: "upcoming", post_visit_notes: "" },
      { id: "demo-appt-2", user_id: userId, doctor: "Dr. Rajan Patel", specialty: "General Physician", datetime: pastDate.toISOString(), location: "City Clinic", notes: "", status: "completed", post_visit_notes: "Prescribed Metformin dosage increase. Follow up in 3 months." },
    ]);

    await db.from("medical_records").upsert([
      {
        id: "demo-rec-1",
        user_id: userId,
        name: "Blood_Test_Report_May2026.txt",
        text_content: "Complete Blood Count Report\nPatient: Demo Patient\nDate: May 2026\n\nHemoglobin: 12.8 g/dL (Normal: 12-16)\nFasting Blood Sugar: 142 mg/dL (Normal: 70-100) - HIGH\nHbA1c: 7.2% (Normal: <5.7%) - HIGH\nTotal Cholesterol: 215 mg/dL (Normal: <200) - BORDERLINE HIGH\nBlood Pressure: 138/88 mmHg - BORDERLINE HIGH\nKidney Function: Normal\nLiver Function: Normal",
        summary: "The blood test shows elevated blood sugar levels (142 mg/dL fasting) and HbA1c of 7.2%, which indicates Type 2 Diabetes is not well controlled. Cholesterol is slightly high at 215 mg/dL. Blood pressure is borderline high at 138/88. Kidney and liver function are normal, which is good. The doctor should be consulted about adjusting diabetes medication and starting a low-cholesterol diet.",
        uploaded_at: med(3),
      }
    ]);

    await db.from("activity_log").insert([
      { user_id: userId, type: "demo", label: "Demo data loaded", at: now.toISOString() },
    ]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load demo data" }, { status: 500 });
  }
}

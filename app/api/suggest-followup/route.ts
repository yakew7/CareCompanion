// SERVER ONLY
import { NextRequest, NextResponse } from "next/server";
import { getGroq, MODEL } from "@/lib/groq";
import { guardAiRoute } from "@/lib/api-guard";

export async function POST(req: NextRequest) {
  const rejected = await guardAiRoute();
  if (rejected) return rejected;
  try {
    const { notes, doctor, specialty } = await req.json();
    if (!notes?.trim()) return NextResponse.json({ suggested: false });

    const completion = await getGroq().chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a medical appointment assistant. Read post-visit notes and detect if a follow-up appointment is recommended.
Return ONLY valid JSON in this exact format:
{
  "suggested": true or false,
  "daysFromNow": number (e.g. 90 for "3 months", 14 for "2 weeks", 365 for "1 year"),
  "reason": "short description of why, e.g. Routine follow-up in 3 months"
}
If no follow-up is mentioned, return { "suggested": false }.`,
        },
        {
          role: "user",
          content: `Doctor: ${String(doctor || "").slice(0, 200)}\nSpecialty: ${String(specialty || "").slice(0, 200)}\nPost-visit notes: ${String(notes).slice(0, 4000)}`,
        },
      ],
      max_tokens: 150,
      temperature: 0,
    });

    const raw = completion.choices[0].message.content?.trim() || "";
    const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}");

    if (!json.suggested || !json.daysFromNow) return NextResponse.json({ suggested: false });
    return NextResponse.json({ suggested: true, daysFromNow: json.daysFromNow, reason: json.reason });
  } catch {
    return NextResponse.json({ suggested: false });
  }
}

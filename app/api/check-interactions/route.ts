import { getGroq, MODEL } from "@/lib/groq";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { newMed, existingMeds } = await req.json() as { newMed: string; existingMeds: string[] };

    if (!newMed || !existingMeds?.length) {
      return Response.json({ hasInteraction: false, message: "" });
    }

    const prompt = `You are a clinical pharmacist assistant. A patient currently takes: ${existingMeds.join(", ")}.
They are adding: ${newMed}.
In 1-2 short sentences, flag any clinically significant drug interaction. If there is no known significant interaction, respond with exactly: "No known interaction."
Do not give dosing advice. Do not add disclaimers. Be direct.`;

    const completion = await getGroq().chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 120,
      temperature: 0.1,
    });

    const message = completion.choices[0]?.message?.content?.trim() || "";
    const hasInteraction = message.length > 0 && !message.toLowerCase().startsWith("no known interaction");

    return Response.json({ hasInteraction, message });
  } catch {
    return Response.json({ hasInteraction: false, message: "", checkFailed: true });
  }
}

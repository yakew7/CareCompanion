// SERVER ONLY
import { NextRequest, NextResponse } from "next/server";
import { getGroq, MODEL_HEALTH_CHAT } from "@/lib/groq";

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json();

    const systemPrompt = `You are a knowledgeable health assistant helping a family caregiver manage their loved one's health. You have access to their current health data below.

RULES:
- Only answer questions related to health, medicine, wellness, nutrition, caregiving, or lifestyle.
- If someone asks something unrelated (e.g. coding, finance, general chat), politely redirect them: "I can only help with health and caregiving questions."
- Always be honest. If something genuinely requires a doctor, say so clearly — do not make up answers.
- Be practical and easy to understand. Avoid unnecessary jargon.
- When relevant, reference the patient's specific data (e.g. "Since they are on Metformin...").
- End responses that contain medical advice with a brief reminder that this is informational and not a substitute for professional medical consultation.

PATIENT HEALTH DATA:
${context || "No health data available yet. Ask the caregiver to add medications, symptoms, and notes first."}`;

    const stream = await getGroq().chat.completions.create({
      model: MODEL_HEALTH_CHAT,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      stream: true,
      max_tokens: 1024,
      temperature: 0.4,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });

    return new NextResponse(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}

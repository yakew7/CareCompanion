// SERVER ONLY — do not import from client components
import { getGroq, MODEL } from "@/lib/groq";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages as { role: "user" | "assistant"; content: string }[];
    const context = (body.context as string)?.slice(0, 8000) || "";

    const systemPrompt = context
      ? `You are a helpful health assistant. The user is a family caregiver. Answer questions about the medical report below in plain English.\n\nReport:\n${context}`
      : "You are a helpful health assistant for family caregivers. Answer health questions in plain English.";

    const stream = await getGroq().chat.completions.create({
      model: MODEL,
      messages: [{ role: "system" as const, content: systemPrompt }, ...messages],
      stream: true,
      max_tokens: 1024,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || "";
            if (text) controller.enqueue(encoder.encode(text));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "AI request failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// SERVER ONLY — do not import from client components
import { getGroq, MODEL } from "@/lib/groq";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = (body.text as string)?.slice(0, 12000);
    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const completion = await getGroq().chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a medical report interpreter for family caregivers with no medical background. Explain this report in simple, clear English. Highlight anything concerning. Avoid all jargon. Use short paragraphs.",
        },
        { role: "user", content: text },
      ],
      max_tokens: 1024,
    });

    return NextResponse.json({
      summary: completion.choices[0].message.content,
    });
  } catch {
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}

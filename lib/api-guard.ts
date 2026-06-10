// SERVER ONLY — auth + rate-limit guard for AI (Groq-proxying) API routes
import "server-only";
import { requireUserId } from "@/lib/require-user";

// Sliding-window rate limit, in-memory (per serverless instance). Good enough
// to stop quota-burning loops; not a substitute for a real limiter at scale.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) hits.clear(); // memory backstop
  return false;
}

/**
 * Returns null when the request may proceed, or a ready-to-return
 * 401/429 Response when it must be rejected.
 */
export async function guardAiRoute(): Promise<Response | null> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (rateLimited(userId)) {
    return Response.json(
      { error: "Too many requests — please slow down." },
      { status: 429 }
    );
  }
  return null;
}

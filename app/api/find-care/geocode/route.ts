import { NextRequest } from "next/server";
import { guardAiRoute } from "@/lib/api-guard";
import {
  FIND_CARE_CONFIG,
  validateGeocodeRequest,
  type GeocodeResult,
} from "@/lib/find-care";
import {
  TtlCache,
  fetchUpstream,
  UpstreamError,
  UpstreamTimeoutError,
} from "@/lib/find-care-cache";

// Per-instance cache of geocode results, keyed by normalized query.
const cache = new TtlCache<GeocodeResult[]>(FIND_CARE_CONFIG.nominatimCacheTtlMs);

function err(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status });
}

async function fetchGeocodeResults(query: string): Promise<GeocodeResult[]> {
  const url = `${FIND_CARE_CONFIG.nominatimEndpoint}?${new URLSearchParams({
    q: query,
    format: "json",
    limit: "5",
    addressdetails: "0",
  }).toString()}`;

  const res = await fetchUpstream(
    url,
    { method: "GET" },
    { timeoutMs: FIND_CARE_CONFIG.nominatimTimeoutMs },
  );

  if (!res.ok) throw new UpstreamError();

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new UpstreamError("malformed_upstream_response");
  }
  if (!Array.isArray(json)) throw new UpstreamError("malformed_upstream_response");

  return json
    .map((r): GeocodeResult | null => {
      const item = r as { display_name?: unknown; lat?: unknown; lon?: unknown };
      const lat = Number(item.lat);
      const lon = Number(item.lon);
      if (typeof item.display_name !== "string" || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
      }
      return { label: item.display_name, lat, lon };
    })
    .filter((r): r is GeocodeResult => r !== null);
}

export async function POST(req: NextRequest) {
  const rejected = await guardAiRoute();
  if (rejected) return rejected;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err("invalid_request", "Request body must be valid JSON.", 400);
  }

  const validated = validateGeocodeRequest(body);
  if (!validated.ok) return err("invalid_request", validated.message, 400);

  const cacheKey = validated.value.query.toLowerCase();

  try {
    const { value: results } = await cache.getOrCompute(cacheKey, () =>
      fetchGeocodeResults(validated.value.query),
    );
    return Response.json({ results }, { status: 200 });
  } catch (e) {
    if (e instanceof UpstreamTimeoutError) {
      return err("upstream_timeout", "The location lookup timed out. Please try again.", 504);
    }
    if (e instanceof UpstreamError) {
      return err("upstream_unavailable", "Location lookup is temporarily unavailable.", 502);
    }
    return err("upstream_unavailable", "Location lookup is temporarily unavailable.", 502);
  }
}

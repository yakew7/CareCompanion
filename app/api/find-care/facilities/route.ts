import { NextRequest } from "next/server";
import { guardAiRoute } from "@/lib/api-guard";
import {
  FIND_CARE_CONFIG,
  buildOverpassQuery,
  processElements,
  validateSearchRequest,
  type FacilityType,
} from "@/lib/find-care";
import {
  TtlCache,
  fetchUpstream,
  UpstreamError,
  UpstreamTimeoutError,
} from "@/lib/find-care-cache";

// Per-instance cache of raw Overpass element payloads, keyed by rounded
// bounding box + sorted types. Distances are recomputed per request from the
// caller's exact origin, so slightly different origins in the same grid cell
// still get accurate distances while sharing the upstream call.
type OverpassElement = Parameters<typeof processElements>[0][number];
const cache = new TtlCache<OverpassElement[]>(FIND_CARE_CONFIG.overpassCacheTtlMs);

const roundGrid = (n: number) => Math.round(n * 1000) / 1000; // ~111 m grid

function err(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status });
}

async function fetchOverpassElements(
  lat: number,
  lon: number,
  radius: number,
  types: FacilityType[],
): Promise<OverpassElement[]> {
  const query = buildOverpassQuery(lat, lon, radius, types);
  const res = await fetchUpstream(
    FIND_CARE_CONFIG.overpassEndpoint,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: query }).toString(),
    },
    { timeoutMs: FIND_CARE_CONFIG.overpassTimeoutMs },
  );

  if (!res.ok) throw new UpstreamError();

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new UpstreamError("malformed_upstream_response");
  }
  const elements = (json as { elements?: unknown })?.elements;
  if (!Array.isArray(elements)) throw new UpstreamError("malformed_upstream_response");
  return elements as OverpassElement[];
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

  const validated = validateSearchRequest(body);
  if (!validated.ok) return err("invalid_request", validated.message, 400);

  const { lat, lon, radius, types } = validated.value;
  const cacheKey = `${roundGrid(lat)},${roundGrid(lon)},${radius},${[...types].sort().join(",")}`;

  try {
    const { value: elements } = await cache.getOrCompute(cacheKey, () =>
      fetchOverpassElements(lat, lon, radius, types),
    );
    const result = processElements(elements, { lat, lon }, types, radius);
    return Response.json(result, { status: 200 });
  } catch (e) {
    if (e instanceof UpstreamTimeoutError) {
      return err("upstream_timeout", "The facility search timed out. Please try again.", 504);
    }
    if (e instanceof UpstreamError) {
      return err("upstream_unavailable", "Facility search is temporarily unavailable.", 502);
    }
    return err("upstream_unavailable", "Facility search is temporarily unavailable.", 502);
  }
}

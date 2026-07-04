import { NextRequest } from "next/server";
import { guardAiRoute } from "@/lib/api-guard";
import {
  FIND_CARE_CONFIG,
  buildOverpassQuery,
  processElements,
  validateSearchRequest,
  isInIndia,
  olaQueryTypesFor,
  processOlaPredictions,
  type FacilityType,
  type OlaPrediction,
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

// Separate cache for Ola predictions (India only), keyed by grid + radius + the
// Ola query-type set. Distances are recomputed per request from the exact origin.
const olaCache = new TtlCache<OlaPrediction[]>(FIND_CARE_CONFIG.olaCacheTtlMs);

const roundGrid = (n: number) => Math.round(n * 1000) / 1000; // ~111 m grid

function err(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status });
}

/**
 * Fetch Ola Maps nearby-search predictions. Ola honours only one `types` value
 * per request, so we issue one request per required query type in parallel and
 * merge/dedupe by place id. If every request fails we throw so the caller falls
 * back to OpenStreetMap; partial failures are tolerated.
 */
async function fetchOlaPredictions(
  lat: number,
  lon: number,
  radius: number,
  types: FacilityType[],
): Promise<OlaPrediction[]> {
  const apiKey = process.env.OLA_MAPS_API_KEY;
  if (!apiKey) throw new UpstreamError();

  const queryTypes = olaQueryTypesFor(types);
  const settled = await Promise.allSettled(
    queryTypes.map(async (qt) => {
      const url = `${FIND_CARE_CONFIG.olaEndpoint}?${new URLSearchParams({
        location: `${lat},${lon}`,
        radius: String(radius),
        layers: "venue",
        withCentroid: "true",
        types: qt,
        limit: String(FIND_CARE_CONFIG.olaResultLimit),
        api_key: apiKey,
      }).toString()}`;
      const res = await fetchUpstream(url, { method: "GET" }, { timeoutMs: FIND_CARE_CONFIG.olaTimeoutMs });
      if (!res.ok) throw new UpstreamError();
      const json: unknown = await res.json();
      const preds = (json as { predictions?: unknown })?.predictions;
      return Array.isArray(preds) ? (preds as OlaPrediction[]) : [];
    }),
  );

  const fulfilled = settled.filter(
    (r): r is PromiseFulfilledResult<OlaPrediction[]> => r.status === "fulfilled",
  );
  if (fulfilled.length === 0) {
    const firstReject = settled.find((r) => r.status === "rejected") as
      | PromiseRejectedResult
      | undefined;
    if (firstReject?.reason instanceof UpstreamTimeoutError) throw firstReject.reason;
    throw new UpstreamError();
  }

  const byId = new Map<string, OlaPrediction>();
  for (const r of fulfilled) {
    for (const p of r.value) {
      const id = p.place_id || p.reference;
      if (id && !byId.has(id)) byId.set(id, p);
    }
  }
  return Array.from(byId.values());
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

  // India + key present → try Ola Maps first (deeper local coverage). Any failure,
  // timeout, or empty result falls through to the global OpenStreetMap path below,
  // so Find Care never goes dark because of Ola. Disable at will with
  // FIND_CARE_DISABLE_OLA=1 without removing the key.
  const olaEnabled = !!process.env.OLA_MAPS_API_KEY && process.env.FIND_CARE_DISABLE_OLA !== "1";
  if (olaEnabled && isInIndia(lat, lon)) {
    try {
      const olaKey = `ola:${roundGrid(lat)},${roundGrid(lon)},${radius},${olaQueryTypesFor(types).sort().join(",")}`;
      const { value: preds } = await olaCache.getOrCompute(olaKey, () =>
        fetchOlaPredictions(lat, lon, radius, types),
      );
      const result = processOlaPredictions(preds, { lat, lon }, types, radius);
      if (result.count > 0) return Response.json(result, { status: 200 });
      // Ola returned nothing usable → fall through to OpenStreetMap for coverage.
    } catch {
      // Ola unavailable/timed out → fall through to OpenStreetMap.
    }
  }

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

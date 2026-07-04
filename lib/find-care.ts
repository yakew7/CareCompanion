// Find Care — shared types, OpenStreetMap tag mapping, distance/normalization
// helpers, validation, and configuration constants.
//
// This module is imported by BOTH the client page (for types, facility-type
// labels, and the filter list) and the server proxy routes (for the Overpass
// query builder, normalization, and validation). It must therefore stay free of
// any `server-only` imports or Node-only APIs.

// ─── Types ─────────────────────────────────────────────────────────────────

/** A care facility resolved from OpenStreetMap. */
export interface Facility {
  id: string;                 // OSM element id, e.g. "node/123"
  name: string;               // Display name; falls back to a type label when unnamed
  lat: number;
  lon: number;
  type: FacilityType;         // Normalized facility category
  address?: string;           // Best-effort formatted address from OSM tags
  phone?: string;             // From contact:phone / phone tags, if present
  distanceMeters: number;     // Straight-line distance from the search origin
}

export type FacilityType =
  | "dialysis" | "hospital" | "pharmacy" | "clinic" | "doctors"
  | "cardiology" | "pulmonology";

/** Request body for POST /api/find-care/facilities. */
export interface SearchRequest {
  lat: number;
  lon: number;
  radius?: number;            // Meters; default 5000; clamped to [500, 25000]
  types: FacilityType[];      // Non-empty
}

/** Response body for POST /api/find-care/facilities. */
export interface SearchResponse {
  facilities: Facility[];     // Sorted by distanceMeters ascending
  count: number;              // facilities.length
  truncated: boolean;         // true if results were capped
}

/** Request body for POST /api/find-care/geocode. */
export interface GeocodeRequest {
  query: string;              // City or postal code; length 2–120
}

export interface GeocodeResult {
  label: string;              // Human-readable resolved place name
  lat: number;
  lon: number;
}

/** Response body for POST /api/find-care/geocode. */
export interface GeocodeResponse {
  results: GeocodeResult[];   // Ordered by upstream relevance; may be empty
}

/** Uniform error envelope for all Find Care API routes. */
export interface ErrorResponse {
  error: string;              // Machine-readable code, e.g. "upstream_unavailable"
  message: string;            // Human-readable explanation
}

// ─── Configuration ───────────────────────────────────────────────────────────
// Single source for tunable values (see the spec's Configuration Reference).
// Shipped as constants in v1.x; some are documented as env candidates.

export const FIND_CARE_CONFIG = {
  defaultRadius: 5000,        // meters
  minRadius: 500,             // meters
  maxRadius: 25000,           // meters
  resultCap: 100,
  overpassCacheTtlMs: 300_000,   // 300 s
  nominatimCacheTtlMs: 3_600_000, // 3600 s
  cacheMaxEntries: 500,
  overpassQueryTimeoutSec: 20, // server-side [timeout:] — Overpass self-terminates and frees its slot at this point
  overpassTimeoutMs: 22_000,  // client abort — kept just above the server-side timeout so Overpass fails first (a clean 502) and the slot recycles, rather than us abandoning a query that keeps running
  nominatimTimeoutMs: 5_000,  // 5 s
  upstreamRetries: 1,         // retries apply to network errors only; a timeout fails fast (see fetchUpstream)
  dedupeDistanceMeters: 50,   // collapse same-name entries within this radius
  userAgent: "CareCompanion/1.2.0 (+https://carecompanion.app)",
  overpassEndpoint: "https://overpass-api.de/api/interpreter",
  nominatimEndpoint: "https://nominatim.openstreetmap.org/search",
  // Ola Maps (India-only POI). The API key is read from process.env.OLA_MAPS_API_KEY
  // in the server route — never placed here, since this constant is bundled to the
  // client. See probing notes in the Ola section below for why these values.
  olaEndpoint: "https://api.olamaps.io/places/v1/nearbysearch",
  olaTimeoutMs: 8_000,      // per Ola request; per-type requests run in parallel
  olaResultLimit: 50,       // Ola caps a nearby-search response at 50 regardless
  olaCacheTtlMs: 300_000,   // 300 s, mirrors Overpass
} as const;

// ─── Region gating ────────────────────────────────────────────────────────────
// Ola Maps only has POI coverage in India, so we route to it solely for origins
// inside this bounding box (mainland + islands + Kashmir); everywhere else falls
// through to the global OpenStreetMap/Overpass path. The bbox is intentionally
// coarse — it catches a few border slivers, where Ola simply returns nothing and
// the OSM fallback covers the request.
export const INDIA_BBOX = { south: 6.5, west: 68.0, north: 37.5, east: 97.5 } as const;

export function isInIndia(lat: number, lon: number): boolean {
  return (
    lat >= INDIA_BBOX.south && lat <= INDIA_BBOX.north &&
    lon >= INDIA_BBOX.west && lon <= INDIA_BBOX.east
  );
}

// ─── Facility classification ─────────────────────────────────────────────────
// Order = selector priority. An element matching multiple selectors is assigned
// the first (highest-priority) matching type. Dialysis first, as per the spec.

export const FACILITY_TYPES: readonly FacilityType[] = [
  "dialysis", "hospital", "pharmacy", "clinic", "doctors", "cardiology", "pulmonology",
] as const;

/** Human-readable labels for filter chips and unnamed-facility fallbacks. */
export const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  dialysis: "Dialysis center",
  hospital: "Hospital",
  pharmacy: "Pharmacy",
  clinic: "Clinic",
  doctors: "Doctor's office",
  cardiology: "Cardiology",
  pulmonology: "Pulmonology",
};

type OsmTags = Record<string, string>;

// Name / speciality regex fragments. Deliberately identical syntax in Overpass
// QL and JavaScript so the query selectors and the classifier below can share
// one source of truth (see FACILITY_DEFS). They MUST stay in sync: an element
// the Overpass query returns but the classifier rejects would be silently
// dropped as "matches no requested type".
//
// The specialty words chosen are unambiguously medical to keep name-based
// matching from catching non-medical POIs (e.g. "cardiac"/"cardiolog" excludes
// a "Cardio" gym; "dialysis"/"pulmonar" are inherently clinical).
const NAME_RE = {
  dialysis: /dialysis/i,
  cardiology: /cardiolog|cardiac/i,
  pulmonology: /pulmonolog|pulmonar|respiratory/i,
} as const;

const nameMatches = (tags: OsmTags, re: RegExp) =>
  re.test(tags.name || "") || re.test(tags.official_name || "");

interface FacilityDef {
  /**
   * Overpass `nw` selectors (nodes and ways) queried for this type. Relations
   * are intentionally excluded: resolving relation-member geometry for an
   * `around` filter is expensive and times out in dense cities, while care
   * facilities are almost always mapped as nodes or ways.
   */
  selectors: string[];
  /** Predicate mirroring the selectors, used to re-classify a returned element. */
  match: (tags: OsmTags) => boolean;
}

// Each type is defined once — selectors and matcher together — so they cannot
// drift apart. Common types (hospital/pharmacy/clinic/doctors) use the widely
// adopted `amenity=*` tag plus a `healthcare=*` fallback. The specialty types
// (dialysis/cardiology/pulmonology) additionally match the `healthcare:speciality`
// tag and the facility name, because the structured `healthcare=*` tags for them
// are sparsely used in many regions (e.g. dialysis centres across India are
// almost always tagged `amenity=hospital`, with "dialysis" only in the name).
//
// Name-based matching is done with an EXACT amenity value prefix
// (`amenity=hospital` etc.), which hits Overpass's key=value index and regexes
// the name only on that small set. A bare `nw[name~...]` — or even a broad
// `nw[amenity~"regex"]` / `nw[healthcare]` (key-presence) prefix — forces a
// scan of every named/amenity element in the radius and times out in dense
// cities. This also keeps precision high (a "Cardio" gym is not amenity=clinic).
// The `match` predicate below stays deliberately lenient: it only ever runs on
// elements a selector already returned, so it must accept all of them.
const namedMedical = (re: string): string[] =>
  ["hospital", "clinic", "doctors"].map((a) => `nw[amenity=${a}][name~"${re}",i]`);

const FACILITY_DEFS: Record<FacilityType, FacilityDef> = {
  dialysis: {
    selectors: [
      `nw[healthcare=dialysis]`,
      `nw["healthcare:speciality"~"dialysis",i]`,
      ...namedMedical("dialysis"),
    ],
    match: (t) =>
      t.healthcare === "dialysis" ||
      NAME_RE.dialysis.test(t["healthcare:speciality"] || "") ||
      nameMatches(t, NAME_RE.dialysis),
  },
  hospital: {
    selectors: [`nw[amenity=hospital]`, `nw[healthcare=hospital]`],
    match: (t) => t.amenity === "hospital" || t.healthcare === "hospital",
  },
  pharmacy: {
    selectors: [
      `nw[amenity=pharmacy]`,
      `nw[healthcare=pharmacy]`,
      `nw[shop=chemist]`,
      `nw[shop=pharmacy]`,
    ],
    match: (t) =>
      t.amenity === "pharmacy" || t.healthcare === "pharmacy" ||
      t.shop === "chemist" || t.shop === "pharmacy",
  },
  clinic: {
    selectors: [`nw[amenity=clinic]`, `nw[healthcare=clinic]`],
    match: (t) => t.amenity === "clinic" || t.healthcare === "clinic",
  },
  doctors: {
    selectors: [`nw[amenity=doctors]`, `nw[healthcare=doctor]`],
    match: (t) => t.amenity === "doctors" || t.healthcare === "doctor",
  },
  cardiology: {
    selectors: [
      `nw["healthcare:speciality"~"cardiolog|cardiac",i]`,
      ...namedMedical("cardiolog|cardiac"),
    ],
    match: (t) =>
      NAME_RE.cardiology.test(t["healthcare:speciality"] || "") ||
      nameMatches(t, NAME_RE.cardiology),
  },
  pulmonology: {
    selectors: [
      `nw["healthcare:speciality"~"pulmonolog|pulmonar|respiratory",i]`,
      ...namedMedical("pulmonolog|pulmonar|respiratory"),
    ],
    match: (t) =>
      NAME_RE.pulmonology.test(t["healthcare:speciality"] || "") ||
      nameMatches(t, NAME_RE.pulmonology),
  },
};

export function isFacilityType(v: unknown): v is FacilityType {
  return typeof v === "string" && (FACILITY_TYPES as readonly string[]).includes(v);
}

/** Does an element's tags match the given facility type's selector(s)? */
function matchesType(tags: OsmTags, type: FacilityType): boolean {
  return FACILITY_DEFS[type].match(tags);
}

/**
 * Assign a single FacilityType to an element by selector priority, restricted to
 * the caller-requested types. Returns null if it matches none of them.
 */
export function classifyElement(tags: OsmTags, requested: FacilityType[]): FacilityType | null {
  const requestedSet = new Set(requested);
  for (const type of FACILITY_TYPES) {
    if (requestedSet.has(type) && matchesType(tags, type)) return type;
  }
  return null;
}

// ─── Distance ─────────────────────────────────────────────────────────────────

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Straight-line (haversine) distance in meters between two coordinates. */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

// ─── Overpass query ─────────────────────────────────────────────────────────

/**
 * Build an Overpass QL query for the requested facility types near a coordinate.
 *
 * Uses a bounding box (global `[bbox:]`) rather than `(around:radius,...)`.
 * `around` makes Overpass compute a distance for every candidate and is markedly
 * slower — heavy enough to time out at large radii in dense cities (the "nothing
 * found" symptom). A bbox is a plain spatial-index range scan; we then trim the
 * square back to the radius circle client-side via haversine (see processElements),
 * so results are identical but the query reliably completes.
 */
export function buildOverpassQuery(
  lat: number,
  lon: number,
  radius: number,
  types: FacilityType[],
): string {
  // Convert the radius to a lat/lon delta. Guard cos() near the poles so the
  // longitude span can't blow up, and clamp the box to valid coordinate ranges.
  const latDelta = radius / 111_320;
  const lonDelta = radius / (111_320 * Math.max(Math.cos(toRad(lat)), 0.01));
  const south = Math.max(lat - latDelta, -90);
  const north = Math.min(lat + latDelta, 90);
  const west = Math.max(lon - lonDelta, -180);
  const east = Math.min(lon + lonDelta, 180);

  const selectors = types
    .flatMap((t) => FACILITY_DEFS[t].selectors)
    .map((sel) => `  ${sel};`)
    .join("\n");

  // `out center tags` returns tags plus a centroid for ways. The server-side
  // [timeout:] is aligned with the client abort so Overpass self-terminates and
  // frees its slot instead of running on after we've stopped waiting.
  return (
    `[out:json][timeout:${FIND_CARE_CONFIG.overpassQueryTimeoutSec}]` +
    `[bbox:${south},${west},${north},${east}];\n(\n${selectors}\n);\nout center tags;`
  );
}

// ─── Normalization ────────────────────────────────────────────────────────────

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
}

function composeAddress(tags: OsmTags): string | undefined {
  const line1 = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const parts = [
    line1,
    tags["addr:suburb"] || tags["addr:neighbourhood"],
    tags["addr:city"] || tags["addr:town"] || tags["addr:village"],
    tags["addr:postcode"],
  ].filter((p): p is string => Boolean(p && p.trim()));
  const address = parts.join(", ");
  return address.length ? address : undefined;
}

/**
 * Normalize one Overpass element to a Facility, computing distance from the
 * search origin. Returns null for elements without coordinates or a match among
 * the requested types (these are discarded).
 */
export function normalizeElement(
  el: OverpassElement,
  origin: { lat: number; lon: number },
  requested: FacilityType[],
): Facility | null {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") return null;

  const type = classifyElement(tags, requested);
  if (!type) return null;

  const name = tags.name || tags.official_name || FACILITY_TYPE_LABELS[type];
  const phone = tags["contact:phone"] || tags.phone || undefined;

  return {
    id: `${el.type}/${el.id}`,
    name,
    lat,
    lon,
    type,
    address: composeAddress(tags),
    phone,
    distanceMeters: Math.round(haversineMeters(origin.lat, origin.lon, lat, lon)),
  };
}

/**
 * De-duplicate facilities: first by OSM id, then collapse entries with an
 * identical normalized name that sit within `dedupeDistanceMeters` of each
 * other, keeping the nearest occurrence.
 */
export function dedupeFacilities(facilities: Facility[]): Facility[] {
  const byId = new Map<string, Facility>();
  for (const f of facilities) {
    const existing = byId.get(f.id);
    if (!existing || f.distanceMeters < existing.distanceMeters) byId.set(f.id, f);
  }

  // Sort nearest-first so the first occurrence kept for a name cluster is closest.
  const unique = Array.from(byId.values()).sort((a, b) => a.distanceMeters - b.distanceMeters);

  const kept: Facility[] = [];
  for (const f of unique) {
    const key = f.name.trim().toLowerCase();
    const isDup = kept.some(
      (k) =>
        k.name.trim().toLowerCase() === key &&
        haversineMeters(k.lat, k.lon, f.lat, f.lon) <= FIND_CARE_CONFIG.dedupeDistanceMeters,
    );
    if (!isDup) kept.push(f);
  }
  return kept;
}

/**
 * Full pipeline: normalize raw Overpass elements, discard unusable ones and any
 * outside the radius (the bbox query returns a square, so trim to the circle),
 * de-duplicate, sort by distance ascending, and cap at the result limit.
 */
/**
 * Shared tail for every provider (OSM and Ola): drop anything outside the radius
 * (bbox / nearby queries can overshoot), de-duplicate, sort by distance ascending,
 * and cap at the result limit. Behaviour is identical to the previous inline logic
 * in processElements.
 */
export function finalizeFacilities(facilities: Facility[], radius: number): SearchResponse {
  const withinRadius = facilities.filter((f) => f.distanceMeters <= radius);
  const deduped = dedupeFacilities(withinRadius).sort(
    (a, b) => a.distanceMeters - b.distanceMeters,
  );
  const truncated = deduped.length > FIND_CARE_CONFIG.resultCap;
  const list = truncated ? deduped.slice(0, FIND_CARE_CONFIG.resultCap) : deduped;
  return { facilities: list, count: list.length, truncated };
}

/** Normalize raw Overpass elements to Facilities (no radius trim / dedupe / cap). */
export function normalizeElements(
  elements: OverpassElement[],
  origin: { lat: number; lon: number },
  requested: FacilityType[],
): Facility[] {
  return elements
    .map((el) => normalizeElement(el, origin, requested))
    .filter((f): f is Facility => f !== null);
}

export function processElements(
  elements: OverpassElement[],
  origin: { lat: number; lon: number },
  requested: FacilityType[],
  radius: number,
): SearchResponse {
  return finalizeFacilities(normalizeElements(elements, origin, requested), radius);
}

// ─── Ola Maps (India) ──────────────────────────────────────────────────────────
// Ola's Nearby Search is category-based with a narrow, fixed vocabulary. Probing
// the live API established: only `hospital`, `pharmacy`, and `doctor` are valid
// query types (`clinic`/`dialysis`/`doctors` return nothing); a request honours
// only ONE type, so we issue one request per type and merge; the response is
// capped at 50; and coordinates appear only when `withCentroid=true`. We therefore
// map each of our categories to the Ola query type(s) that can surface it, then
// re-classify every returned place with the SAME priority order and name regexes
// used for OpenStreetMap, so results stay shaped and filtered consistently.

export interface OlaPrediction {
  description?: string;
  place_id?: string;
  reference?: string;
  structured_formatting?: { main_text?: string; secondary_text?: string };
  types?: string[];
  geometry?: { location?: { lat?: number; lng?: number } };
}

// Our category → Ola query type(s). The union across requested categories is at
// most {hospital, pharmacy, doctor} → three parallel requests. Specialty and
// clinic categories have no Ola type, so they ride on the broad hospital/doctor
// results and are isolated by name matching in olaMatchesType.
const OLA_QUERY_TYPES: Record<FacilityType, readonly string[]> = {
  dialysis: ["hospital", "doctor"],
  hospital: ["hospital"],
  pharmacy: ["pharmacy"],
  clinic: ["doctor"],
  doctors: ["doctor"],
  cardiology: ["hospital", "doctor"],
  pulmonology: ["hospital", "doctor"],
};

/** The de-duplicated set of Ola query types needed for the requested categories. */
export function olaQueryTypesFor(requested: FacilityType[]): string[] {
  const set = new Set<string>();
  for (const t of requested) for (const q of OLA_QUERY_TYPES[t]) set.add(q);
  return Array.from(set);
}

function olaMatchesType(place: OlaPrediction, type: FacilityType): boolean {
  const types = new Set((place.types || []).map((s) => s.toLowerCase()));
  const name = place.structured_formatting?.main_text || place.description || "";
  switch (type) {
    case "dialysis":    return NAME_RE.dialysis.test(name);
    case "hospital":    return types.has("hospital");
    case "pharmacy":    return types.has("pharmacy") || types.has("drugstore");
    case "clinic":      return types.has("clinic") || /\bclinic\b|polyclinic/i.test(name);
    case "doctors":     return types.has("doctor");
    case "cardiology":  return NAME_RE.cardiology.test(name);
    case "pulmonology": return NAME_RE.pulmonology.test(name);
  }
  return false;
}

/** Assign a single category by priority order, restricted to the requested types. */
export function classifyOlaPlace(place: OlaPrediction, requested: FacilityType[]): FacilityType | null {
  const requestedSet = new Set(requested);
  for (const type of FACILITY_TYPES) {
    if (requestedSet.has(type) && olaMatchesType(place, type)) return type;
  }
  return null;
}

/** Normalize one Ola prediction to a Facility, or null if unusable/unmatched. */
export function normalizeOlaPlace(
  place: OlaPrediction,
  origin: { lat: number; lon: number },
  requested: FacilityType[],
): Facility | null {
  const lat = place.geometry?.location?.lat;
  const lon = place.geometry?.location?.lng;
  if (typeof lat !== "number" || typeof lon !== "number") return null;

  const type = classifyOlaPlace(place, requested);
  if (!type) return null;

  const id = place.place_id || place.reference;
  if (!id) return null;

  return {
    id: `ola/${id}`,
    name: place.structured_formatting?.main_text || FACILITY_TYPE_LABELS[type],
    lat,
    lon,
    type,
    address: place.structured_formatting?.secondary_text || undefined,
    phone: undefined, // Ola's basic nearby search does not return phone numbers
    distanceMeters: Math.round(haversineMeters(origin.lat, origin.lon, lat, lon)),
  };
}

/** Normalize Ola predictions to Facilities (no radius trim / dedupe / cap). */
export function normalizeOlaPredictions(
  preds: OlaPrediction[],
  origin: { lat: number; lon: number },
  requested: FacilityType[],
): Facility[] {
  return preds
    .map((p) => normalizeOlaPlace(p, origin, requested))
    .filter((f): f is Facility => f !== null);
}

/** Full Ola pipeline: normalize → shared radius-trim / dedupe / sort / cap. */
export function processOlaPredictions(
  preds: OlaPrediction[],
  origin: { lat: number; lon: number },
  requested: FacilityType[],
  radius: number,
): SearchResponse {
  return finalizeFacilities(normalizeOlaPredictions(preds, origin, requested), radius);
}

// ─── Validation ───────────────────────────────────────────────────────────────

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

/** Clamp a radius into [minRadius, maxRadius], defaulting when absent/invalid. */
export function clampRadius(radius: unknown): number {
  const { defaultRadius, minRadius, maxRadius } = FIND_CARE_CONFIG;
  if (typeof radius !== "number" || !Number.isFinite(radius)) return defaultRadius;
  return Math.min(maxRadius, Math.max(minRadius, radius));
}

/** Validate a facilities-search request body. */
export function validateSearchRequest(body: unknown): ValidationResult<Required<SearchRequest>> {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Request body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.lat !== "number" || !Number.isFinite(b.lat) || b.lat < -90 || b.lat > 90) {
    return { ok: false, message: "lat must be a number between -90 and 90." };
  }
  if (typeof b.lon !== "number" || !Number.isFinite(b.lon) || b.lon < -180 || b.lon > 180) {
    return { ok: false, message: "lon must be a number between -180 and 180." };
  }
  if (!Array.isArray(b.types) || b.types.length === 0) {
    return { ok: false, message: "types must be a non-empty array." };
  }
  if (!b.types.every(isFacilityType)) {
    return { ok: false, message: "types contains an unsupported facility type." };
  }
  // De-duplicate requested types while preserving priority order.
  const types = FACILITY_TYPES.filter((t) => (b.types as FacilityType[]).includes(t));

  return {
    ok: true,
    value: { lat: b.lat, lon: b.lon, radius: clampRadius(b.radius), types },
  };
}

/** Validate a geocode request body. */
export function validateGeocodeRequest(body: unknown): ValidationResult<{ query: string }> {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Request body must be a JSON object." };
  }
  const raw = (body as Record<string, unknown>).query;
  if (typeof raw !== "string") {
    return { ok: false, message: "query must be a string." };
  }
  const query = raw.trim();
  if (query.length < 2 || query.length > 120) {
    return { ok: false, message: "query must be between 2 and 120 characters." };
  }
  return { ok: true, value: { query } };
}

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
  resultCap: 50,
  overpassCacheTtlMs: 300_000,   // 300 s
  nominatimCacheTtlMs: 3_600_000, // 3600 s
  cacheMaxEntries: 500,
  overpassTimeoutMs: 10_000,  // 10 s
  nominatimTimeoutMs: 5_000,  // 5 s
  upstreamRetries: 1,
  dedupeDistanceMeters: 50,   // collapse same-name entries within this radius
  userAgent: "CareCompanion/1.2.0 (+https://carecompanion.app)",
  overpassEndpoint: "https://overpass-api.de/api/interpreter",
  nominatimEndpoint: "https://nominatim.openstreetmap.org/search",
} as const;

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
  /** Overpass `nwr` selectors (nodes, ways, relations) queried for this type. */
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
// the name only on that small set. A bare `nwr[name~...]` — or even a broad
// `nwr[amenity~"regex"]` / `nwr[healthcare]` (key-presence) prefix — forces a
// scan of every named/amenity element in the radius and times out in dense
// cities. This also keeps precision high (a "Cardio" gym is not amenity=clinic).
// The `match` predicate below stays deliberately lenient: it only ever runs on
// elements a selector already returned, so it must accept all of them.
const namedMedical = (re: string): string[] =>
  ["hospital", "clinic", "doctors"].map((a) => `nwr[amenity=${a}][name~"${re}",i]`);

const FACILITY_DEFS: Record<FacilityType, FacilityDef> = {
  dialysis: {
    selectors: [
      `nwr[healthcare=dialysis]`,
      `nwr["healthcare:speciality"~"dialysis",i]`,
      ...namedMedical("dialysis"),
    ],
    match: (t) =>
      t.healthcare === "dialysis" ||
      NAME_RE.dialysis.test(t["healthcare:speciality"] || "") ||
      nameMatches(t, NAME_RE.dialysis),
  },
  hospital: {
    selectors: [`nwr[amenity=hospital]`, `nwr[healthcare=hospital]`],
    match: (t) => t.amenity === "hospital" || t.healthcare === "hospital",
  },
  pharmacy: {
    selectors: [`nwr[amenity=pharmacy]`, `nwr[healthcare=pharmacy]`],
    match: (t) => t.amenity === "pharmacy" || t.healthcare === "pharmacy",
  },
  clinic: {
    selectors: [`nwr[amenity=clinic]`, `nwr[healthcare=clinic]`],
    match: (t) => t.amenity === "clinic" || t.healthcare === "clinic",
  },
  doctors: {
    selectors: [`nwr[amenity=doctors]`, `nwr[healthcare=doctor]`],
    match: (t) => t.amenity === "doctors" || t.healthcare === "doctor",
  },
  cardiology: {
    selectors: [
      `nwr["healthcare:speciality"~"cardiolog|cardiac",i]`,
      ...namedMedical("cardiolog|cardiac"),
    ],
    match: (t) =>
      NAME_RE.cardiology.test(t["healthcare:speciality"] || "") ||
      nameMatches(t, NAME_RE.cardiology),
  },
  pulmonology: {
    selectors: [
      `nwr["healthcare:speciality"~"pulmonolog|pulmonar|respiratory",i]`,
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

/** Build an Overpass QL query for the requested facility types within radius. */
export function buildOverpassQuery(
  lat: number,
  lon: number,
  radius: number,
  types: FacilityType[],
): string {
  const selectors = types
    .flatMap((t) => FACILITY_DEFS[t].selectors)
    .map((sel) => `  ${sel}(around:${radius},${lat},${lon});`)
    .join("\n");
  // `out center tags` returns tags plus a centroid for ways/relations.
  return `[out:json][timeout:25];\n(\n${selectors}\n);\nout center tags;`;
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
 * Full pipeline: normalize raw Overpass elements, discard unusable ones,
 * de-duplicate, sort by distance ascending, and cap at the result limit.
 */
export function processElements(
  elements: OverpassElement[],
  origin: { lat: number; lon: number },
  requested: FacilityType[],
): SearchResponse {
  const normalized = elements
    .map((el) => normalizeElement(el, origin, requested))
    .filter((f): f is Facility => f !== null);

  const deduped = dedupeFacilities(normalized).sort(
    (a, b) => a.distanceMeters - b.distanceMeters,
  );

  const truncated = deduped.length > FIND_CARE_CONFIG.resultCap;
  const facilities = truncated ? deduped.slice(0, FIND_CARE_CONFIG.resultCap) : deduped;

  return { facilities, count: facilities.length, truncated };
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

// Geocode quality classification.
//
// Deliberately NOT a single numeric score. A scalar hides *why* a result was
// rejected, and the reason is what the customer needs in order to fix their
// address. Classification is a pure function of the provider response so it can
// be exhaustively tested without any network call.
//
// The governing rule: a job is published only when we are confident where it is.
// Anything less keeps it in DRAFT with an actionable message. There is no
// fallback that publishes anyway, and none that notifies every category-
// qualified pro — that was the original defect, and it is what made a job in
// Crum Lynne reach nobody while appearing in every pro's list.

export type GeocodeDecision =
  | { outcome: "accept"; reason: "rooftop" }
  | { outcome: "confirm"; reason: "range_interpolated"; normalizedAddress: string }
  | { outcome: "reject"; reason: RejectReason; message: string };

export type RejectReason =
  | "zero_results"
  | "partial_match"
  | "ambiguous"
  | "missing_components"
  | "country_mismatch"
  | "region_conflict"
  | "imprecise_location"
  | "provider_unavailable";

export type LocationType =
  | "ROOFTOP"
  | "RANGE_INTERPOLATED"
  | "GEOMETRIC_CENTER"
  | "APPROXIMATE";

export interface AddressComponent {
  types: string[];
  short_name: string;
  long_name: string;
}

export interface GeocodeCandidate {
  types: string[];
  partial_match?: boolean;
  formatted_address: string;
  address_components: AddressComponent[];
  geometry: { location_type: LocationType; location: { lat: number; lng: number } };
  place_id: string;
}

export interface SubmittedAddress {
  country?: string; // ISO-3166-1 alpha-2; defaults to US
  state?: string;   // 2-letter US state
  postalCode?: string;
}

// Address-level result types. A result typed only as a locality or postal code
// describes an area, not a place someone can be sent to.
const ADDRESS_LEVEL_TYPES = ["street_address", "premise", "subpremise"];

// Components required before a US address is considered locatable.
//
// Each entry is a set of INTERCHANGEABLE component types — the requirement is
// met if any one of them is present.
//
// The town slot is why this is a list rather than a flat array. Google does not
// return `locality` for New York City borough addresses; it returns
// `sublocality` / `sublocality_level_1` ("Queens") instead. Demanding `locality`
// therefore rejected a ROOFTOP match that had street number, route, state and
// ZIP — and told the customer "that address is missing some detail", which they
// could do nothing about because nothing was missing. Every NYC borough address
// failed this way, and a job with no coordinates falls back to notifying pros
// regardless of distance.
const REQUIRED_COMPONENTS: string[][] = [
  ["street_number"],
  ["route"],
  ["locality", "sublocality", "sublocality_level_1", "postal_town"],
  ["administrative_area_level_1"],
  ["postal_code"],
];

function component(candidate: GeocodeCandidate, type: string): AddressComponent | undefined {
  return candidate.address_components.find((c) => c.types.includes(type));
}

// Customer-facing text. It must say what to do, not what went wrong internally —
// "we could not geocode your address" is useless to someone trying to post a job.
const MESSAGES: Record<RejectReason, string> = {
  zero_results:
    "We couldn't find that address. Check the street number and spelling, then try again.",
  partial_match:
    "We could only match part of that address. Add the street number and ZIP code so pros can find you.",
  ambiguous:
    "That address matches more than one place. Add the ZIP code to pin it down.",
  missing_components:
    "That address is missing some detail. Include the street number, city, state and ZIP code.",
  country_mismatch:
    "Tarea currently serves US addresses only.",
  region_conflict:
    "The city, state and ZIP code don't match. Check them and try again.",
  imprecise_location:
    "We could only locate that address approximately. Add the street number and ZIP code so we can match nearby pros.",
  provider_unavailable:
    "We couldn't verify your address just now. Please try again in a moment.",
};

function reject(reason: RejectReason): GeocodeDecision {
  return { outcome: "reject", reason, message: MESSAGES[reason] };
}

/**
 * Classify a provider response into publish / confirm / hold.
 *
 * `candidates` is the provider's result list. An empty list means zero results.
 * `unavailable` marks a timeout or provider error — distinct from zero results,
 * because the address may be perfectly valid and only the provider is down.
 */
export function classifyGeocode(
  candidates: GeocodeCandidate[],
  submitted: SubmittedAddress = {},
  opts: { unavailable?: boolean } = {}
): GeocodeDecision {
  if (opts.unavailable) return reject("provider_unavailable");
  if (candidates.length === 0) return reject("zero_results");

  // More than one address-level candidate means the input genuinely did not
  // identify one place. Picking the first would silently guess.
  const addressLevel = candidates.filter((c) =>
    c.types.some((t) => ADDRESS_LEVEL_TYPES.includes(t))
  );
  if (addressLevel.length > 1) return reject("ambiguous");

  const best = addressLevel[0] ?? candidates[0];

  if (best.partial_match === true) return reject("partial_match");

  if (!best.types.some((t) => ADDRESS_LEVEL_TYPES.includes(t))) {
    return reject("imprecise_location");
  }

  const country = component(best, "country")?.short_name;
  const expectedCountry = submitted.country ?? "US";
  if (country && country !== expectedCountry) return reject("country_mismatch");

  const missing = REQUIRED_COMPONENTS.filter(
    (alternatives) => !alternatives.some((t) => component(best, t))
  );
  if (missing.length > 0) return reject("missing_components");

  // The customer's stated state/ZIP must agree with the resolved address.
  // Disagreement usually means a typo that would otherwise place the job in the
  // wrong town — and silently trusting the provider would distribute it there.
  const state = component(best, "administrative_area_level_1")?.short_name;
  if (submitted.state && state && submitted.state.toUpperCase() !== state.toUpperCase()) {
    return reject("region_conflict");
  }
  const postal = component(best, "postal_code")?.short_name;
  if (submitted.postalCode && postal && submitted.postalCode.trim() !== postal.trim()) {
    return reject("region_conflict");
  }

  switch (best.geometry.location_type) {
    case "ROOFTOP":
      return { outcome: "accept", reason: "rooftop" };
    case "RANGE_INTERPOLATED":
      // Interpolated along a street segment: close, but not observed. Publish
      // only once the customer confirms the normalized address we resolved.
      return {
        outcome: "confirm",
        reason: "range_interpolated",
        normalizedAddress: best.formatted_address,
      };
    case "GEOMETRIC_CENTER":
    case "APPROXIMATE":
    default:
      return reject("imprecise_location");
  }
}

/** Coordinates are read only from an accepted or confirmed decision. */
export function coordsFrom(candidate: GeocodeCandidate): { lat: number; lng: number } {
  return { lat: candidate.geometry.location.lat, lng: candidate.geometry.location.lng };
}

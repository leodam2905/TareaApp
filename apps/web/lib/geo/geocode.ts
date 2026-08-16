// The HTTP half of geocoding: ask Google, let quality.ts decide.
//
// WHY THIS EXISTS
//
// A customer types an address when posting a job and nothing ever turned it
// into coordinates. The app sent the PHONE's position instead — and only when
// location permission happened to be granted — so a job posted from the sofa
// for a house across town was located at the sofa, and a job posted with
// permission denied had no position at all. Distance matching therefore ran on
// nothing: not one job or pro in the database had usable coordinates.
//
// classifyGeocode() already knew how to judge a Google result. Nothing called
// Google. This is that call, and nothing more — the judgement stays there.

import { classifyGeocode, coordsFrom, type GeocodeCandidate, type GeocodeDecision, type SubmittedAddress } from "./quality";

export interface GeocodeOutcome {
  decision: GeocodeDecision;
  coords: { lat: number; lng: number } | null;
  formattedAddress?: string;
}

const ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";

// A posted job waits on this, so it cannot hang. Google is usually well under a
// second; past this we treat the provider as unavailable and let the job
// through without coordinates rather than failing the post.
const TIMEOUT_MS = 4000;

/**
 * Geocodes a free-text address.
 *
 * Never throws: a posting flow must not fail because a geocoder did. Every
 * failure path returns a decision — `provider_unavailable` when the call itself
 * failed, which quality.ts deliberately distinguishes from "no such address".
 */
export async function geocodeAddress(
  address: string,
  submitted: SubmittedAddress = {},
): Promise<GeocodeOutcome> {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key || !address.trim()) {
    return { decision: classifyGeocode([], submitted, { unavailable: !key }), coords: null };
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set("address", address.trim());
  url.searchParams.set("key", key);
  // Bias to the submitted country so "Springfield" resolves in the right one.
  if (submitted.country) url.searchParams.set("region", submitted.country.toLowerCase());

  let candidates: GeocodeCandidate[] = [];
  let unavailable = false;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);

    if (!res.ok) {
      unavailable = true;
    } else {
      const body = await res.json();
      // Google reports its own errors in `status`, with HTTP 200. OVER_QUERY_LIMIT
      // and REQUEST_DENIED are provider problems, not bad addresses — calling them
      // "address not found" would blame the customer for our billing.
      if (body?.status === "OK") {
        candidates = (body.results ?? []) as GeocodeCandidate[];
      } else if (body?.status === "ZERO_RESULTS") {
        candidates = [];
      } else {
        unavailable = true;
      }
    }
  } catch {
    // Abort, DNS, TLS — all provider-side as far as the caller is concerned.
    unavailable = true;
  }

  const decision = classifyGeocode(candidates, submitted, { unavailable });

  if (decision.outcome === "reject") return { decision, coords: null };

  // accept | confirm both carry a usable position; `confirm` means Google
  // interpolated along a street rather than hitting a rooftop.
  const best =
    candidates.find((c) => c.types.some((t) => ["street_address", "premise", "subpremise"].includes(t))) ??
    candidates[0];

  return {
    decision,
    coords: best ? coordsFrom(best) : null,
    formattedAddress: best?.formatted_address,
  };
}

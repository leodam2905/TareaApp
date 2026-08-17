import { describe, it, expect } from "vitest";
import { classifyGeocode, type GeocodeCandidate, type LocationType } from "./quality";

// Builds a well-formed US address-level candidate. Tests override only the field
// under test, so a failure names one cause.
function candidate(over: Partial<GeocodeCandidate> = {}, locationType: LocationType = "ROOFTOP"): GeocodeCandidate {
  return {
    types: ["street_address"],
    formatted_address: "123 Main St, Darby, PA 19023, USA",
    place_id: "place_abc",
    address_components: [
      { types: ["street_number"], short_name: "123", long_name: "123" },
      { types: ["route"], short_name: "Main St", long_name: "Main Street" },
      { types: ["locality"], short_name: "Darby", long_name: "Darby" },
      { types: ["administrative_area_level_1"], short_name: "PA", long_name: "Pennsylvania" },
      { types: ["postal_code"], short_name: "19023", long_name: "19023" },
      { types: ["country"], short_name: "US", long_name: "United States" },
    ],
    geometry: { location_type: locationType, location: { lat: 39.9187, lng: -75.2585 } },
    ...over,
  };
}

describe("classifyGeocode — acceptance", () => {
  // Regression: a real New York job posted 2026-08-17 got no coordinates.
  //
  // Google does not return `locality` for NYC borough addresses — it returns
  // `sublocality` ("Queens"). The required-components check demanded `locality`,
  // so a ROOFTOP match with street number, route, state and ZIP was rejected as
  // "missing some detail", and the job fell back to being notified to pros
  // regardless of distance. An LA pro was pinged for a job in New York.
  it("accepts an NYC borough address, where Google omits locality", () => {
    const nyc = candidate({
      formatted_address: "1-23 Main St, Queens, NY 10001, USA",
      types: ["street_address", "subpremise"],
      address_components: [
        { types: ["street_number"], short_name: "1-23", long_name: "1-23" },
        { types: ["route"], short_name: "Main St", long_name: "Main Street" },
        { types: ["sublocality", "sublocality_level_1"], short_name: "Queens", long_name: "Queens" },
        { types: ["administrative_area_level_1"], short_name: "NY", long_name: "New York" },
        { types: ["postal_code"], short_name: "10001", long_name: "10001" },
        { types: ["country"], short_name: "US", long_name: "United States" },
      ],
    });
    expect(classifyGeocode([nyc]).outcome).toBe("accept");
  });

  it("still rejects when the town is absent entirely", () => {
    const noTown = candidate({
      address_components: [
        { types: ["street_number"], short_name: "123", long_name: "123" },
        { types: ["route"], short_name: "Main St", long_name: "Main Street" },
        { types: ["administrative_area_level_1"], short_name: "PA", long_name: "Pennsylvania" },
        { types: ["postal_code"], short_name: "19023", long_name: "19023" },
        { types: ["country"], short_name: "US", long_name: "United States" },
      ],
    });
    const d = classifyGeocode([noTown]);
    expect(d.outcome).toBe("reject");
    if (d.outcome === "reject") expect(d.reason).toBe("missing_components");
  });

  it("accepts a ROOFTOP address-level result", () => {
    const d = classifyGeocode([candidate()]);
    expect(d.outcome).toBe("accept");
  });

  it("accepts premise and subpremise as address-level", () => {
    for (const t of ["premise", "subpremise"]) {
      expect(classifyGeocode([candidate({ types: [t] })]).outcome).toBe("accept");
    }
  });

  it("treats an absent partial_match the same as false", () => {
    const c = candidate();
    delete (c as { partial_match?: boolean }).partial_match;
    expect(classifyGeocode([c]).outcome).toBe("accept");
  });
});

describe("classifyGeocode — confirmation required", () => {
  it("asks for confirmation on RANGE_INTERPOLATED and returns the normalized address", () => {
    const d = classifyGeocode([candidate({}, "RANGE_INTERPOLATED")]);
    expect(d.outcome).toBe("confirm");
    if (d.outcome === "confirm") {
      expect(d.normalizedAddress).toBe("123 Main St, Darby, PA 19023, USA");
    }
  });

  it("never publishes an interpolated result without confirmation", () => {
    // Guards the core invariant: only "accept" may publish directly.
    expect(classifyGeocode([candidate({}, "RANGE_INTERPOLATED")]).outcome).not.toBe("accept");
  });
});

describe("classifyGeocode — rejection keeps the job in DRAFT", () => {
  it("rejects zero results", () => {
    const d = classifyGeocode([]);
    expect(d).toMatchObject({ outcome: "reject", reason: "zero_results" });
  });

  it("rejects a partial match", () => {
    const d = classifyGeocode([candidate({ partial_match: true })]);
    expect(d).toMatchObject({ outcome: "reject", reason: "partial_match" });
  });

  it("rejects GEOMETRIC_CENTER and APPROXIMATE", () => {
    for (const lt of ["GEOMETRIC_CENTER", "APPROXIMATE"] as LocationType[]) {
      const d = classifyGeocode([candidate({}, lt)]);
      expect(d).toMatchObject({ outcome: "reject", reason: "imprecise_location" });
    }
  });

  it("rejects multiple address-level candidates as ambiguous rather than guessing", () => {
    const d = classifyGeocode([candidate(), candidate({ place_id: "place_def" })]);
    expect(d).toMatchObject({ outcome: "reject", reason: "ambiguous" });
  });

  it("rejects a non-address-level result such as a locality", () => {
    const d = classifyGeocode([candidate({ types: ["locality", "political"] })]);
    expect(d).toMatchObject({ outcome: "reject", reason: "imprecise_location" });
  });

  it("rejects when a required component is missing", () => {
    const c = candidate();
    c.address_components = c.address_components.filter((x) => !x.types.includes("street_number"));
    expect(classifyGeocode([c])).toMatchObject({ outcome: "reject", reason: "missing_components" });
  });

  it("rejects a non-US country", () => {
    const c = candidate();
    c.address_components = c.address_components.map((x) =>
      x.types.includes("country") ? { ...x, short_name: "CA", long_name: "Canada" } : x
    );
    expect(classifyGeocode([c])).toMatchObject({ outcome: "reject", reason: "country_mismatch" });
  });

  it("rejects a state that contradicts the submitted address", () => {
    const d = classifyGeocode([candidate()], { state: "NJ" });
    expect(d).toMatchObject({ outcome: "reject", reason: "region_conflict" });
  });

  it("rejects a postal code that contradicts the submitted address", () => {
    const d = classifyGeocode([candidate()], { postalCode: "19104" });
    expect(d).toMatchObject({ outcome: "reject", reason: "region_conflict" });
  });

  it("rejects when the provider is unavailable, distinctly from zero results", () => {
    const d = classifyGeocode([candidate()], {}, { unavailable: true });
    expect(d).toMatchObject({ outcome: "reject", reason: "provider_unavailable" });
  });

  it("gives every rejection an actionable, non-empty message", () => {
    const cases = [
      classifyGeocode([]),
      classifyGeocode([candidate({ partial_match: true })]),
      classifyGeocode([candidate({}, "APPROXIMATE")]),
      classifyGeocode([candidate()], {}, { unavailable: true }),
    ];
    for (const d of cases) {
      expect(d.outcome).toBe("reject");
      if (d.outcome === "reject") {
        expect(d.message.length).toBeGreaterThan(20);
        // Must tell the customer what to do, not describe our internals.
        expect(d.message.toLowerCase()).not.toContain("geocod");
      }
    }
  });
});

// One place that knows a US state by any of the names it is stored under.
//
// user.state holds whatever the signup form produced — production currently
// has both "pennsylvania" and "CA" — while ActiveState stores two-letter
// codes. Comparing them directly meant "pennsylvania" was never `in ["PA",
// ...]`, so /api/match filtered out every pro whose state had been saved as a
// full name and returned an empty list for everybody. It had been dead long
// enough that nothing called it.
//
// Normalising on read rather than migrating the column: the rows are user
// input from several form versions and a rewrite would need care, whereas
// matching on either form is correct today and stays correct after a cleanup.

const NAME_TO_CODE: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI",
  minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT",
  nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY",
};

const CODE_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(NAME_TO_CODE).map(([name, code]) => [code, name]),
);

/** Two-letter code for anything recognisable, or null. */
export function stateCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (/^[A-Za-z]{2}$/.test(v)) {
    const up = v.toUpperCase();
    return CODE_TO_NAME[up] ? up : null;
  }
  return NAME_TO_CODE[v.toLowerCase()] ?? null;
}

/**
 * Every spelling a state might be stored as, for an `in` filter.
 *
 * Cheaper and safer than normalising in JS after the query: the database still
 * does the filtering, and no row is loaded only to be discarded.
 */
export function stateAliases(codes: string[]): string[] {
  const out = new Set<string>();
  for (const c of codes) {
    const code = stateCode(c);
    if (!code) continue;
    out.add(code);
    out.add(code.toLowerCase());
    const name = CODE_TO_NAME[code];
    if (name) {
      out.add(name);
      out.add(name.replace(/\b\w/g, (m) => m.toUpperCase()));
    }
  }
  return [...out];
}

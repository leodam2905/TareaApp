// Tarea operates in the US and every distance a person sets or reads is in
// miles: a pro's serviceRadius is stored in miles, and the customer's tracking
// screen counts down in miles. Kilometres exist only inside the matching maths
// (haversine returns km, and radiusKmFor converts the pro's miles to compare).
//
// So distances are converted once, here, on the way OUT of the API — rather
// than in each client, which is how a pro ended up configuring "50 miles" and
// then being told a job was "18 km" away.
export const KM_PER_MILE = 1.60934;

export const milesFromKm = (km: number): number => km / KM_PER_MILE;

/** Miles for a distance that may be unknown. Null in, null out — an unknown
 *  distance is not zero, and must never render as "0 mi away". */
export const milesFromKmOrNull = (km: number | null | undefined): number | null =>
  km === null || km === undefined ? null : milesFromKm(km);

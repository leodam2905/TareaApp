/// Distances shown to people are always in miles.
///
/// Tarea is US-only: a pro sets their serviceRadius in miles and the tracking
/// screen counts down in miles. Kilometres exist only inside the server's
/// matching maths. The API now returns `distanceMiles` already converted, but
/// this keeps the fallback so a new app pointed at an older server shows miles
/// rather than a km figure wearing a "mi" label.
const double kmPerMile = 1.60934;

double milesFromKm(num km) => km / kmPerMile;

/// Reads a distance off an API payload, preferring the server's miles.
/// Returns null when the distance is unknown — which is not the same as zero
/// and must never render as "0 mi away".
double? distanceMilesFrom(Map<String, dynamic> json) {
  final mi = json['distanceMiles'];
  if (mi is num) return mi.toDouble();
  final km = json['distanceKm'];
  if (km is num) return milesFromKm(km);
  return null;
}

// Tarea's fee, mirrored from apps/web/lib/fees.ts.
//
// The app hardcoded 1.15 and 0.15 in four places, so changing the platform fee
// server-side would have left the app quoting a total the customer was never
// charged. One constant, and the four call sites read from it.
//
// It still has to be kept in step with the server by hand — the honest fix is
// serving the rate alongside the service catalogue so the app reads it, which
// needs a build to adopt either way.
const double kCustomerFeeRate = 0.2778;

/// What the customer pays for a job: labour plus the fee, plus materials at
/// cost. Materials carry NO fee — they pass through, as reimbursements do.
double customerTotal(num labour, [num materials = 0]) =>
    labour * (1 + kCustomerFeeRate) + materials;

/// The rate as the customer must SEE it, for the "Service fee (x)" labels.
///
/// Those labels said "15%" in all four languages while the amount beside them
/// was computed from kCustomerFeeRate — so the app printed a percentage the
/// card was never charged. Derived here so the two can never disagree again.
final String kFeePct =
    '${(kCustomerFeeRate * 100).toStringAsFixed(2).replaceFirst(RegExp(r'\.?0+$'), '')}%';

/// The fee alone, for showing as its own line.
double serviceFee(num labour) => labour * kCustomerFeeRate;

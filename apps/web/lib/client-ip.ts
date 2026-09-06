/**
 * The caller's real IP address, for rate limiting.
 *
 * Every IP-keyed limit in this app depends on getting this right, and there are
 * two ways to get it wrong -- opposite failures, both serious:
 *
 *   chain[0]            the value the CALLER supplied. Anyone can send
 *                       `X-Forwarded-For: <anything>` and land in a fresh
 *                       bucket per request, so no limit binds at all. This is
 *                       what all ten routes used to do.
 *
 *   chain[length - 1]   the LOAD BALANCER, identical for every visitor on
 *                       earth. Keying on it puts all users in ONE bucket, so
 *                       ten failed logins globally lock everyone out. A
 *                       self-inflicted outage that reads like a mystery.
 *
 * taptarea.com resolves to 34.110.225.91 -- a global external HTTPS load
 * balancer -- which appends `<client IP>, <LB IP>` to whatever arrived. Measured
 * against production rather than reasoned about:
 *
 *   no header sent:  "68.81.101.90, 34.110.225.91"
 *   header spoofed:  "203.0.113.99, 68.81.101.90, 34.110.225.91"
 *
 * The last two entries are always [real client, LB] no matter how many entries
 * the attacker prepends, so SECOND-FROM-LAST is the real client.
 *
 * ⚠️ This holds only for traffic through the load balancer. Cloud Run's own
 * *.run.app URL, if ingress is left at `all`, appends just the client IP -- so
 * second-from-last there is the ATTACKER's value. The service must stay on
 * `internal-and-cloud-load-balancing` for this function to be sound. Do not try
 * to detect the path at runtime: `Via` and the hop count are both things the
 * caller can forge, so inferring the ingress is guessing about attacker-
 * controlled input. Close the direct path instead.
 */
export function clientIp(req: { headers: { get(name: string): string | null } }): string {
  const chain = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (chain.length >= 2) return chain[chain.length - 2];

  // Single entry means the request did not traverse the LB. Post-ingress-
  // restriction this is unreachable from the internet; it still happens for
  // local dev and internal probes, where chain[0] is the honest answer.
  return chain[0] ?? req.headers.get("x-real-ip") ?? "unknown";
}

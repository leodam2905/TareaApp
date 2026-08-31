export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { licenseAlwaysRequired } from "@/lib/credentials";

// Everything a customer has posted, with the photos they attached.
//
// The photos are the point: they are the only customer-supplied content on the
// platform that nobody reviews before pros see it, and they are attached to a
// street address. This is where that gets looked at.
//
// It also surfaces two ways a job goes quiet without anyone being told:
//
//   DRAFT — geocoding failed or came back low-confidence, so the request was
//     never published. Every read path filters status="OPEN", which makes a
//     DRAFT job invisible to pros AND unappliable, with the customer seeing a
//     job they believe is live. geocodeError says why.
//
//   STRANDED — an open job in a licence-only trade with no applicants. Roofing
//     and HVAC fan out to licensed pros only, so where none has onboarded yet
//     the job reaches nobody. POST /job-requests now tells the customer that at
//     posting time; this is the other half, so somebody can go and recruit.
export default async function AdminJobRequestsPage() {
  const requests = await prisma.jobRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true, email: true } },
      applications: { select: { id: true } },
    },
  });

  const isStranded = (r: (typeof requests)[number]) =>
    r.status === "OPEN" && licenseAlwaysRequired(r.category) && r.applications.length === 0;

  const counts = {
    all: requests.length,
    open: requests.filter((r) => r.status === "OPEN").length,
    draft: requests.filter((r) => r.status === "DRAFT").length,
    "with photos": requests.filter((r) => r.imageUrls.length > 0).length,
    stranded: requests.filter(isStranded).length,
  };

  const statusColor: Record<string, string> = {
    OPEN: "badge-sky",
    ASSIGNED: "badge-green",
    CLOSED: "badge",
    DRAFT: "badge-yellow",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Posted Jobs</h1>
        <p className="text-slate-400 mt-1">
          Every job request customers have posted, with the photos they attached
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        {Object.entries(counts).map(([key, val]) => (
          <div key={key} className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm">
            <span className="text-slate-400 capitalize">{key}:</span>
            <span className="text-white font-bold ml-1">{val}</span>
          </div>
        ))}
      </div>

      {counts.draft > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-amber-300 text-sm">
          ⚠ {counts.draft} job{counts.draft > 1 ? "s are" : " is"} stuck in DRAFT — geocoding
          failed, so no pro can see or apply to them. The customer has not been told.
        </div>
      )}

      {counts.stranded > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-400 text-sm">
          ⚠ {counts.stranded} open job{counts.stranded > 1 ? "s" : ""} in a licence-only trade
          with no applicants. Roofing and HVAC reach licensed pros only — these are waiting on
          supply, not on interest.
        </div>
      )}

      <div className="grid gap-4">
        {requests.map((r) => {
          const stranded = isStranded(r);
          return (
            <div
              key={r.id}
              className={`bg-white/5 border rounded-2xl p-5 flex gap-5 flex-col lg:flex-row ${
                stranded
                  ? "border-red-500/30"
                  : r.status === "DRAFT"
                    ? "border-amber-500/30"
                    : "border-white/10"
              }`}
            >
              {/* Photos — the reason this page exists. */}
              <div className="flex gap-2 flex-wrap lg:w-64 shrink-0">
                {r.imageUrls.length === 0 ? (
                  <div className="w-24 h-24 rounded-xl bg-white/5 border border-white/10 grid place-items-center text-slate-600 text-xs">
                    No photo
                  </div>
                ) : (
                  r.imageUrls.map((url, i) => (
                    <a
                      key={url + i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl overflow-hidden border border-white/10 hover:border-tarea-sky/50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-tarea-sky"
                      title="Open full size"
                    >
                      {/* Plain img: these are customer uploads on a storage host,
                          and next/image would need every one allow-listed. */}
                      <img
                        src={url}
                        alt={`Photo ${i + 1} of ${r.title}`}
                        loading="lazy"
                        className="w-24 h-24 object-cover"
                      />
                    </a>
                  ))
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-white font-semibold">{r.title}</p>
                    <p className="text-slate-500 text-xs">
                      {r.category}
                      {licenseAlwaysRequired(r.category) && (
                        <span className="text-amber-400 ml-2">· licence required</span>
                      )}
                    </p>
                  </div>
                  <div className="ml-auto flex gap-2 items-center">
                    {r.urgency === "URGENT" && <span className="badge-red">URGENT</span>}
                    <span className={statusColor[r.status] ?? "badge"}>{r.status}</span>
                  </div>
                </div>

                <p className="text-slate-300 text-sm line-clamp-2">{r.description}</p>

                {r.status === "DRAFT" && r.geocodeError && (
                  <p className="text-amber-400/80 text-xs">
                    Geocode failed: {r.geocodeError}
                  </p>
                )}

                <div className="flex gap-x-6 gap-y-1 flex-wrap text-xs text-slate-400 pt-1">
                  <span>
                    <span className="text-slate-500">Customer </span>
                    {r.customer.name} · {r.customer.email}
                  </span>
                  <span>
                    <span className="text-slate-500">Where </span>
                    {r.city}
                  </span>
                  <span>
                    <span className="text-slate-500">Labour </span>
                    <span className="text-emerald-400 font-semibold">
                      {formatCurrency(r.budgetMin)}
                    </span>
                    {r.materialsCost > 0 && (
                      <span className="text-slate-500"> + {formatCurrency(r.materialsCost)} materials</span>
                    )}
                  </span>
                  <span>
                    <span className="text-slate-500">Applicants </span>
                    <span className={stranded ? "text-red-400 font-semibold" : "text-white"}>
                      {r.applications.length}
                    </span>
                  </span>
                  <span>
                    <span className="text-slate-500">Scheduled </span>
                    {formatDate(r.scheduledAt)}
                  </span>
                  <span>
                    <span className="text-slate-500">Posted </span>
                    {formatDate(r.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {requests.length === 0 && (
          <div className="text-center text-slate-500 py-10 bg-white/5 border border-white/10 rounded-2xl">
            No jobs posted yet
          </div>
        )}
      </div>
    </div>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { hireAmounts } from "@/lib/hire";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { CUSTOMER_FEE_RATE } from "@/lib/fees";
import { sendEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { sendSms } from "@/lib/sms";
import { smsBody, createNotification } from "@/lib/notify";
import { geocodeAddress } from "@/lib/geo/geocode";
import { milesFromKmOrNull } from "@/lib/units";
import { CREDENTIAL_SELECT, credentialBadges, licenseAlwaysRequired, licenseMatters } from "@/lib/credentials";
import { materialsTier, validateMaterials } from "@/lib/materials-policy";
import { ABSOLUTE_MINIMUM_CHARGE } from "@/lib/labor-pricing";
import { notifyProsOfJob, haversine, radiusKmFor } from "@/lib/job-fanout";

// Fallback only. Each pro sets their own serviceRadius in miles, and that is
// what decides eligibility — this applies when a profile somehow has none.
//
// A single global radius was the bug: a flat travel allowance paid the same for
// a 3-mile trip and a 40-mile one, so pros were offered work that could not pay
// for the drive. Distance cannot be priced (the price is fixed before a pro is
// chosen), so it is bounded instead, by the only party who knows what their
// time is worth.
// California contractor licensing — the Minor Work Exemption, B&P §7048.
//
// AB 2622 (Carrillo, Ch. 240, Stats. 2024) raised this from $500 to $1,000
// effective 1 January 2025. The threshold is the AGGREGATE contract price:
// "labor, materials, and all other items" — not labour alone, and materials
// count even when the homeowner buys them directly.
//
// TWO CONDITIONS THIS CODE CANNOT CHECK, and which void the exemption
// regardless of price:
//
//   - any work requiring a building permit needs a licence, at any value;
//   - the exemption applies only to someone working alone. A pro who hires or
//     subcontracts needs a licence even under $1,000.
//
// So this cap is necessary, not sufficient. A job under it may still legally
// require a licensed pro, and nothing here can determine that.
//
// Project splitting is also prohibited: a large job cannot be invoiced as
// several small ones to stay under the cap. Worth watching for if the same
// customer posts repeated jobs just below it.
const CSLB_UNLICENSED_CAP = 1000;

/** Human name for the trades that are licensed-only, for customer-facing copy. */
const LICENSED_TRADE_LABEL: Record<string, string> = {
  ROOFING: "Roofing",
  HVAC: "Heating and cooling work",
};



// Customer: get own requests  |  Handyman: get matching open requests
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.role === "CUSTOMER") {
    const requests = await prisma.jobRequest.findMany({
      where: { customerId: user.id },
      include: {
        applications: {
          include: {
            user: { select: { name: true, avatarUrl: true } },
            // Credentials travel with the applicant. This is the screen where a
            // customer picks who comes to their house, and it showed name,
            // stars and a bold total — so the loudest differentiator was price
            // and a licence was invisible. Browse sorts licensed-and-insured
            // above everything precisely because that risk does not shrink as a
            // rating improves; the comparison screen was the one place that
            // reasoning had not reached.
            handyman: {
              select: {
                rating: true, totalJobs: true, bio: true, yearsExperience: true,
                ...CREDENTIAL_SELECT,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Price each application the way hiring it actually would.
    //
    // Pros quote their own materials, so two applicants on the same job cost
    // the customer different amounts — and the app was showing one number for
    // the request, which was whichever figure happened to be on the request
    // itself. Computed here, from hireAmounts, so the number a customer
    // compares against is the number they will be charged; a second
    // arithmetic in the app is how a preview and a checkout end up disagreeing.
    const priced = requests.map((r) => ({
      ...r,
      applications: r.applications.map((a) => {
        const materials = a.materialsEstimate ?? r.materialsCost ?? 0;
        // THIS applicant's labour, in the same order materializeHire resolves
        // it. Passing r.budgetMin here priced every applicant identically, so
        // the only thing that moved between rows was materials — and the number
        // shown was not the number charged for anyone whose rate differed.
        const labour = a.proposedPrice ?? r.budgetMin;
        const amounts = hireAmounts(labour, materials);
        // Approved and unexpired, not "a file was uploaded" — the same
        // predicate the ranking, the fan-out gate and the invoice all use.
        const badges = a.handyman ? credentialBadges(a.handyman) : { licensed: false, insured: false };
        return {
          ...a,
          handyman: a.handyman
            ? {
                rating: a.handyman.rating,
                totalJobs: a.handyman.totalJobs,
                bio: a.handyman.bio,
                yearsExperience: a.handyman.yearsExperience,
              }
            : a.handyman,
          // Whether a licence is a MEANINGFUL distinction here. A licensed
          // cleaner is not a safer cleaner, and badging one implies otherwise.
          licenseRelevant: licenseMatters(r.category),
          licensed: badges.licensed,
          insured: badges.insured,
          // What THIS pro quoted for parts, falling back to the figure on the
          // request when they did not name one.
          effectiveMaterials: Math.round(amounts.materials * 100) / 100,
          // Labour and fee as their own numbers. The row showed materials and a
          // total, so a customer could see two applicants differ and had no way
          // to see why — and once labour varies by pro, materials is no longer
          // even the main reason it does.
          effectiveLabour: Math.round(amounts.labour * 100) / 100,
          serviceFee: Math.round(amounts.serviceFee * 100) / 100,
          // What hiring this pro would cost, all in.
          customerTotal:
            Math.round((amounts.labour + amounts.serviceFee + amounts.materials) * 100) / 100,
        };
      }),
    }));
    return NextResponse.json(priced);
  }

  // Handyman: return ALL open requests, optionally filtered by their service categories
  const profile = user.handymanProfile;
  if (!profile) return NextResponse.json([]);

  const myServices = await prisma.service.findMany({
    where: { handymanId: profile.id, isActive: true },
    select: { category: true },
  });
  const myCategories = myServices.map(s => s.category);

  // Jobs at or over the CSLB unlicensed cap are reserved for Licensed & Insured
  // pros (license + insurance on file). See the filter below for the rule.
  const docs = await prisma.handymanProfile.findUnique({
    where: { id: profile.id }, select: CREDENTIAL_SELECT,
  });
  // This gate decides who may take work at or over the CSLB $1,000 cap, so it
  // has to mean "an admin approved these and they have not lapsed" — not "two
  // files were uploaded". Presence of a PDF used to be enough, which let any
  // pro who uploaded anything take jobs the law reserves for licensed pros.
  const badges = docs ? credentialBadges(docs) : { licensed: false, insured: false };
  const licensedInsured = badges.licensed && badges.insured;

  const requests = await prisma.jobRequest.findMany({
    where: {
      status: "OPEN",
      // GENERAL is included for every pro, matching the notification fan-out.
      // If these two disagreed a pro would get the push and then find nothing
      // in the list, which is worse than not being told at all.
      ...(myCategories.length > 0
          ? { category: { in: myCategories.concat("GENERAL" as never).filter((c, n, a) => a.indexOf(c) === n) as never[] } }
        : {}),
      // Applied jobs are NOT excluded any more. Removing them made a job the
      // pro had just applied to vanish from the only screen that had ever
      // shown it, which is indistinguishable from the job being withdrawn.
      // They stay in the feed, flagged `applied`, for the UI to show as
      // already-applied rather than offer again.
    },
    include: {
      customer: { select: { name: true, city: true, avatarUrl: true } },
      applications: { select: { id: true, handymanId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const handymanUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { latitude: true, longitude: true },
  });

  const scored = requests
    .map(r => {
      const distanceKm =
        handymanUser?.latitude && handymanUser?.longitude && r.latitude && r.longitude
          ? haversine(handymanUser.latitude, handymanUser.longitude, r.latitude, r.longitude)
          : null;
      // The street address and coordinates are NOT sent to a browsing pro.
      //
      // Spreading the row handed every approved pro the customer's exact home
      // address before they had applied, let alone been hired. The find-jobs
      // screen only ever shows city and distance, so nothing displayed it — it
      // just sat in the payload. Once a pro IS hired the address reaches them
      // through the booking (pro_job_detail reads it from there), which is the
      // point at which they need it.
      const { address: _address, latitude: _lat, longitude: _lng, ...safe } = r;
      // distanceKm stays for older app builds that read it; distanceMiles is
      // what every UI shows.
      return {
        ...safe,
        distanceKm,
        distanceMiles: milesFromKmOrNull(distanceKm),
        // Server-owned, so the badge survives an app restart — it used to live
        // in one screen's in-memory Set.
        applied: r.applications.some(a => a.handymanId === profile.id),
        score: 0,
      };
    })
    // Same rule as the notification fan-out: the pro's own radius. If these
    // disagreed a pro would be told about a job they cannot then see.
    .filter(r => r.distanceKm === null || r.distanceKm <= radiusKmFor(profile.serviceRadius))
    // Measured against what the CUSTOMER pays in total, which is the most
    // conservative reading of "labor, materials, and all other items": the
    // service price, the Service Fee charged on it, and materials.
    //
    // Whether Tarea's fee belongs in a contract price between customer and pro
    // is arguable. Including it only ever routes MORE work to licensed pros,
    // which is the safe direction to be wrong in.
    //
    // Materials are an estimate at posting and can grow during a job, so this
    // is a floor on exposure rather than a guarantee.
    .filter(r => {
      // Some trades are licensed-only whatever the job is worth. The cap below
      // is a ceiling on unpermitted work, and roofing and HVAC are permitted
      // work almost by definition — a $400 roof repair is no more lawful for an
      // unlicensed pro than a $4,000 one. Checked FIRST so price cannot excuse
      // it. See LICENSE_ALWAYS in lib/credentials.
      // Two reasons a job is licensed-only, one gate. The category rule is the
      // law's and cannot be switched off; requiresLicensed is the customer's.
      // Either alone is sufficient; neither widens the other.
      if ((licenseAlwaysRequired(r.category) || r.requiresLicensed) && !licensedInsured) return false;

      const total = r.budgetMax * (1 + CUSTOMER_FEE_RATE) + (r.materialsCost ?? 0);
      if (total > CSLB_UNLICENSED_CAP && !licensedInsured) return false;
      // Second, independent reason to reserve a job: the parts bill alone.
      //
      // A job can sit well under the aggregate cap and still ask a pro to front
      // several hundred dollars. Filtering it out here rather than letting the
      // pro apply and be refused matters — the apply route rejects it too, but
      // a pro who has already written a quote and been turned away learns the
      // rule the expensive way.
      return licensedInsured || materialsTier(r.materialsCost) === "open";
    })
    // Newest first.
    //
    // The query already ordered by createdAt desc and this sort was throwing
    // that away, ranking purely by distance — so a week-old job two miles away
    // sat above one posted a minute ago. A pro opening this list is looking for
    // what has just come in; distance is still applied as the radius filter
    // above and is shown on every card, so nothing is lost by not ranking on it.
    //
    // Distance breaks ties between jobs posted in the same second.
    .sort((a, b) => {
      const byNewest = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (byNewest !== 0) return byNewest;
      return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);
    });

  return NextResponse.json(scored);
}

// Customer creates a job request
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { category, title, description, address, city, scheduledAt, budgetMin, budgetMax, materialsCost, latitude, longitude, imageUrls, urgency, estimatedBillableMinutes, requiresLicensed } = await req.json();

  if (!category || !title || !description || !address || !city || !scheduledAt) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const materials = validateMaterials(materialsCost);
  if (!materials.ok) return NextResponse.json({ error: materials.error }, { status: 400 });

  // Fraud protection, enforced HERE and not only in the quoting routes.
  //
  // This endpoint takes budgetMin at face value, so without a server-side check
  // a request created straight against the API could post real work for a cent.
  //
  // It used to reject anything under grossMinimum() ($120), which was a price
  // floor rather than a fraud check: a job is now priced at the PRO's rate over
  // a minimum billable TIME (migration 013), so a cheaper pro legitimately
  // quotes less than $120 and this would have refused their honest price. A
  // dollar floor that binds sets one price for every competing pro, which is
  // exactly what 013 removed.
  //
  // REJECTED, not silently raised. Quietly changing the number would show the
  // customer one price and charge another.
  const floor = ABSOLUTE_MINIMUM_CHARGE;
  const labour = budgetMin ? parseFloat(budgetMin) : 0;
  if (!Number.isFinite(labour)) {
    return NextResponse.json({ error: "Budget must be a number." }, { status: 400 });
  }
  if (labour > 0 && labour < floor) {
    return NextResponse.json(
      { error: `A job must be at least $${floor.toFixed(2)} of labour.`, minimum: floor },
      { status: 400 },
    );
  }

  // Geocode what the customer actually typed.
  //
  // The app sends the PHONE's position, and only when location permission was
  // granted — so a job posted from the sofa for a house across town was located
  // at the sofa, and one posted with permission denied had no position at all.
  // The address is the job's location; the phone is not. Client coordinates are
  // kept only as a fallback for when geocoding cannot resolve the address.
  let geoLat: number | undefined = latitude ? parseFloat(latitude) : undefined;
  let geoLng: number | undefined = longitude ? parseFloat(longitude) : undefined;

  const geo = await geocodeAddress(`${address}, ${city}`, { country: "US" });
  if (geo.coords) {
    geoLat = geo.coords.lat;
    geoLng = geo.coords.lng;
  }

  // A job we cannot place is held as DRAFT rather than published.
  //
  // The schema has said this since the column was added — "DRAFT = geocoding
  // failed or was low confidence; not published, not matchable" — and nothing
  // implemented it: the decision was computed, thrown away, and the request
  // published anyway. Two things then went wrong quietly. The client sends the
  // PHONE's position, so a job whose address did not resolve was located
  // wherever the customer happened to be standing; and with no coordinates at
  // all it passed every radius check in the system, because those read
  // `distanceKm === null || within range`.
  //
  // Held, not rejected: the customer has written the job out and attached
  // photos, and the fix is usually one wrong digit. An admin repairs the
  // address and publishes it — see PATCH /api/admin/job-requests/[id].
  const rejected = geo.decision.outcome === "reject" ? geo.decision : null;
  const isDraft = rejected !== null;

  // Can anybody actually take this job?
  //
  // For roofing and HVAC the fan-out below reaches licensed pros only, so where
  // none exists the request is posted into silence: no applicants, no reason
  // given, and a push that promises to tell the customer "when a pro applies".
  // That is the same silent-empty failure the browse radius fallback exists to
  // prevent, one surface over.
  //
  // The request is still CREATED. Refusing would throw away the one signal that
  // says which trades to recruit into, and a customer told plainly that we are
  // still onboarding licensed roofers in their area is a customer who might
  // wait. A customer whose job sits untouched for a week is not.
  // Only offered where a licence distinguishes anyone — a licensed cleaner is
  // not a safer cleaner. Coerced rather than trusted: the field is a boolean.
  const wantsLicensed = requiresLicensed === true && licenseMatters(category);

  let eligibleProCount: number | null = null;
  if (licenseAlwaysRequired(category) || wantsLicensed) {
    const candidates = await prisma.handymanProfile.findMany({
      where: {
        backgroundCheckStatus: "PASSED",
        services: { some: { category: category as never, isActive: true } },
      },
      select: CREDENTIAL_SELECT,
      take: 50,
    });
    eligibleProCount = candidates.filter((c) => {
      const b = credentialBadges(c);
      return b.licensed && b.insured;
    }).length;
  }
  const noEligiblePros = eligibleProCount === 0;

  const jobRequest = await prisma.jobRequest.create({
    data: {
      customerId: user.id,
      status: isDraft ? "DRAFT" : "OPEN",
      requiresLicensed: wantsLicensed,
      // Why it failed, so an admin sees which address to fix rather than
      // guessing. Recorded on success too, so a bad rooftop match is traceable.
      geocodeError: rejected ? rejected.message : null,
      geocodeSource: geo.decision.outcome,
      geocodedAt: new Date(),
      category,
      title,
      description,
      address,
      city,
      latitude:  geoLat,
      longitude: geoLng,
      scheduledAt: new Date(scheduledAt),
      budgetMin: budgetMin ? parseFloat(budgetMin) : 0,
      budgetMax: budgetMax ? parseFloat(budgetMax) : 0,
      // Every applicant quotes against these minutes at their own rate, so the
      // customer's comparison is like-for-like. Clamped: an unbounded value
      // from the client would let a crafted request price a job at any size.
      estimatedBillableMinutes: estimatedBillableMinutes
        ? Math.min(Math.max(Math.round(Number(estimatedBillableMinutes)), 15), 60 * 40)
        : null,
      materialsCost: materials.value,
      urgency: ["STANDARD", "SOON", "URGENT"].includes(urgency) ? urgency : "STANDARD",
      imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
    },
  });

  // Tell the pros. Extracted to lib/job-fanout so the admin repair path can
  // run the same thing when it publishes a DRAFT — a job that becomes visible
  // without this is in every Find Jobs list and in nobody's notifications.
  //
  // Skipped entirely for a DRAFT: it is not published, so there is nothing to
  // announce, and announcing it would send pros to a job they cannot see.
  const notified = isDraft ? 0 : await notifyProsOfJob(jobRequest);

  // A job nobody can see is the marketplace's worst failure, and it used to
  // happen in silence: the block above is skipped, and the customer is still
  // told their request is live. Record it and tell the admins, so a hole in
  // coverage is something somebody knows about.
  if (!isDraft && notified === 0) {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    await Promise.allSettled(
      admins.map((a) =>
        createNotification({
          userId: a.id,
          title: "Job reached no pros",
          body: `"${title}" (${category}) in ${city} matched no available pro. The customer has not been told.`,
          type: "booking_cancelled",
          refId: jobRequest.id,
        }),
      ),
    );
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "job_reached_no_pros",
        jobId: jobRequest.id,
        category,
        city,
        geocoded: geo.decision.outcome,
      }),
    );
  }

  // Confirmation to the customer on their own device.
  await prisma.notification.create({
    data: {
      userId: user.id,
      title: "Job posted",
      body: `Your "${title}" request is live. We'll let you know when a pro applies.`,
      // Same reason as the application notification: this refId is a
      // jobRequest, so it must not route to booking detail.
      type: "job_application",
      refId: jobRequest.id,
    },
  });
  // Do not promise applicants when nobody can apply.
  await sendPushToUser(
    user.id,
    noEligiblePros ? "Job posted — finding a licensed pro" : "Job posted ✅",
    noEligiblePros
      ? `Your "${title}" request is live. ${LICENSED_TRADE_LABEL[category] ?? "This work"} needs a licensed pro, and we do not have one in your area yet — we will tell you the moment we do.`
      : `Your "${title}" request is live — we'll notify you when a pro applies.`,
    { type: "booking_request", screen: "Requests", jobId: jobRequest.id }
  );

  // `notice` is additive: a client that does not know the field renders exactly
  // what it rendered before, so this needs no coordinated app release.
  return NextResponse.json(
    {
      ...jobRequest,
      ...(noEligiblePros
        ? {
            noEligiblePros: true,
            notice: licenseAlwaysRequired(category)
              ? `${LICENSED_TRADE_LABEL[category] ?? "This work"} requires a licensed and insured pro. `
                + "We do not have one in your area yet, so this may take longer than usual — "
                + "we will notify you as soon as one joins."
              // Their own restriction, so say so — and say it is theirs to lift.
              : "You asked for licensed and insured pros only, and we do not have one "
                + "in your area yet. We will notify you as soon as one joins, or you can "
                + "reopen this job to all background-checked pros.",
          }
        : {}),
    },
    { status: 201 },
  );
}

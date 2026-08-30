import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notify";
import { CUSTOMER_FEE_RATE } from "@/lib/fees";
import { resolveRate, quoteLabor, resolveMinimumMinutes } from "./labor-pricing";

// Hiring an applicant IS paying them.
//
// It used to be two steps: accepting an application marked the job ASSIGNED,
// rejected every other applicant and told the winner "You got the job!" — then
// asked the customer to pay within 2 hours. A pro could therefore be told they
// had won a job that quietly evaporated on a payment timeout, with the runners
// up already rejected and the request closed.
//
// Nothing here happens until Stripe confirms the money. An abandoned checkout
// leaves the request open, every applicant still in the running, and the pro
// none the wiser.

/** What the customer is charged to hire an applicant: labour + fee, materials at cost.
 *
 * The discount comes off LABOUR before the service fee is computed, matching
 * bookingAmounts() in lib/booking-charge. Applying it after the fee would charge
 * 15% on money the customer never pays, and the two paths would quietly disagree
 * about what a promo is worth.
 *
 * Materials are never discounted — they are a pass-through at cost, and a promo
 * that ate into them would take the difference out of the pro's reimbursement.
 */
export function hireAmounts(budgetMin: number, materials: number, discount = 0): {
  labour: number;
  serviceFee: number;
  materials: number;
  discount: number;
} {
  const full = Math.max(0, budgetMin);
  const applied = Math.min(Math.max(0, discount), full);
  const labour = full - applied;
  return {
    labour,
    serviceFee: labour * CUSTOMER_FEE_RATE,
    materials: Math.max(0, materials),
    discount: applied,
  };
}

/**
 * Turns a paid hire checkout into a real, confirmed booking.
 *
 * Idempotent on the payment intent: a redelivered webhook finds the booking
 * already there and returns it instead of hiring the pro twice.
 */
export async function materializeHire(opts: {
  jobRequestId: string;
  applicationId: string;
  paymentIntentId: string | null;
  sessionId: string | null;
  promoCodeId?: string | null;
}) {
  const { jobRequestId, applicationId, paymentIntentId, sessionId, promoCodeId } = opts;

  if (paymentIntentId) {
    const existing = await prisma.booking.findFirst({ where: { stripePaymentIntentId: paymentIntentId } });
    if (existing) return existing;
  }

  const jobRequest = await prisma.jobRequest.findUnique({ where: { id: jobRequestId } });
  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    include: { user: true },
  });
  if (!jobRequest || !application || application.jobRequestId !== jobRequestId) {
    console.error("[hire] Paid hire has no matching request/application", { jobRequestId, applicationId });
    return null;
  }

  // Two checkout sessions can exist for one request if the customer tapped
  // Hire twice before paying. The first payment assigns the request; a second
  // must not produce a second booking for the same job — it is a double charge
  // to refund by hand, not a second hire to honour.
  if (jobRequest.status === "ASSIGNED") {
    const already = await prisma.booking.findFirst({
      where: {
        customerId: jobRequest.customerId,
        handymanId: application.user.id,
        scheduledAt: jobRequest.scheduledAt,
      },
      orderBy: { createdAt: "desc" },
    });
    if (already) {
      console.error("[hire] DUPLICATE PAYMENT for an already-hired request — refund owed", {
        jobRequestId,
        applicationId,
        paymentIntentId,
        existingBookingId: already.id,
      });
      return already;
    }
  }

  // Now the money is in: this pro is hired and the others are not.
  await prisma.jobApplication.update({ where: { id: applicationId }, data: { status: "ACCEPTED" } });
  await prisma.jobRequest.update({ where: { id: jobRequestId }, data: { status: "ASSIGNED" } });
  await prisma.jobApplication.updateMany({
    where: { jobRequestId, id: { not: applicationId } },
    data: { status: "REJECTED" },
  });

  // A hire must ALWAYS produce a customer booking. Use the pro's matching
  // service if they have one; otherwise create a private (inactive) service
  // from the job so a booking can exist even when the pro has no listing in
  // this category.
  const price = jobRequest.budgetMin ?? 0;
  let service = await prisma.service.findFirst({
    where: { handymanId: application.handymanId, category: jobRequest.category },
    orderBy: { isActive: "desc" },
  });
  // A service row carries the pro's rate for that category. This one is created
  // from a job rather than chosen by the pro, so it inherits their profile rate.
  const proRate = await prisma.handymanProfile.findUnique({
    where: { id: application.handymanId },
    select: { hourlyRate: true },
  });
  if (!service) {
    service = await prisma.service.create({
      data: {
        handymanId: application.handymanId,
        title: jobRequest.title,
        description: (jobRequest.description || jobRequest.title).slice(0, 500),
        category: jobRequest.category,
        hourlyRate: proRate?.hourlyRate || null,
        minPrice: price,
        maxPrice: jobRequest.budgetMax ?? price,
        duration: 60,
        isActive: false,
      },
    });
  }

  // Freeze what this job was priced FROM, exactly as the directed path does.
  //
  // This was missing: a booking created from a job request carried totalPrice
  // and nothing else. Two things broke as a result. An extra-time request fell
  // back to re-reading the pro's CURRENT rate, so a pro who raised it mid-job
  // billed the customer at the new rate for work agreed at the old one — the
  // precise thing a snapshot exists to prevent. And an invoice could not
  // reproduce its own figure for half the bookings on the platform.
  //
  // The rate is the one that priced the application (same resolveRate order),
  // and the minutes are the estimate every applicant quoted against, so the
  // snapshot reconstructs the number the customer actually agreed to.
  const { hourlyRate: ratePriced } = resolveRate({
    serviceHourlyRate: service.hourlyRate,
    profileHourlyRate: proRate?.hourlyRate,
    category: jobRequest.category,
  });
  const minimumMinutes = resolveMinimumMinutes(service.minimumMinutes);
  const laborQuote = jobRequest.estimatedBillableMinutes
    ? quoteLabor({
        hourlyRate: ratePriced,
        estimatedBillableMinutes: jobRequest.estimatedBillableMinutes,
        minimumMinutes,
        urgent: jobRequest.urgency === "URGENT",
      })
    : null;

  const booking = await prisma.booking.create({
    data: {
      customerId: jobRequest.customerId,
      handymanId: application.user.id,
      serviceId: service.id,
      // So completion can close the request this job came from.
      jobRequestId: jobRequest.id,
      // Paid before it existed — the pro applied, the customer hired and paid,
      // so there is nobody left to wait for.
      status: "ACCEPTED",
      isPaid: true,
      stripePaymentIntentId: paymentIntentId,
      stripeSessionId: sessionId,
      scheduledAt: jobRequest.scheduledAt,
      address: jobRequest.address,
      city: jobRequest.city,
      // What the customer paid. The pro's own rate produced it — their
      // application was quoted at rate x the job's estimated minutes — and the
      // charge has already gone through, so this figure is settled, not derived.
      totalPrice: price,
      proRateSnapshot: ratePriced,
      estimatedBillableMinutes: jobRequest.estimatedBillableMinutes,
      initialLaborAmount: laborQuote?.initialLaborAmount ?? price,
      minimumMinutesSnapshot: minimumMinutes,
      pricingType: "hourly",
      ...(promoCodeId ? { promoCodeId } : {}),
      materialsEstimate: application.materialsEstimate ?? jobRequest.materialsCost ?? 0,
    },
  });

  // Count the redemption HERE, not when the checkout opened.
  //
  // A promo is spent when money moves. Counting it at checkout creation would
  // let an abandoned payment burn a use — and referral codes are issued with a
  // maxUses limit, so a customer could lose their 10% by opening a payment page
  // and closing it. (The directed-booking path still counts at booking
  // creation; worth aligning, but that is a separate change.)
  if (promoCodeId) {
    await prisma.promoCode
      .update({ where: { id: promoCodeId }, data: { usesCount: { increment: 1 } } })
      .catch((err) => console.error("[hire] could not record promo use:", err));
  }

  await Promise.all([
    createNotification({
      userId: application.user.id,
      title: "You got the job — and it's paid ✓",
      body: `You were hired for "${jobRequest.title}". The customer has already paid; Tarea holds the funds until you complete the job.`,
      type: "booking_accepted",
      refId: booking.id,
    }),
    createNotification({
      userId: jobRequest.customerId,
      title: "Booking confirmed ✓",
      body: `You hired ${application.user.name} for "${jobRequest.title}". Your payment is held by Tarea until the job is done.`,
      type: "booking_accepted",
      refId: booking.id,
    }),
  ]);

  return booking;
}

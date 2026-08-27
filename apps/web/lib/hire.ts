import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notify";
import { CUSTOMER_FEE_RATE } from "@/lib/fees";

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

/** What the customer is charged to hire an applicant: labour + fee, materials at cost. */
export function hireAmounts(budgetMin: number, materials: number): {
  labour: number;
  serviceFee: number;
  materials: number;
} {
  const labour = Math.max(0, budgetMin);
  return { labour, serviceFee: labour * CUSTOMER_FEE_RATE, materials: Math.max(0, materials) };
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
}) {
  const { jobRequestId, applicationId, paymentIntentId, sessionId } = opts;

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
  if (!service) {
    service = await prisma.service.create({
      data: {
        handymanId: application.handymanId,
        title: jobRequest.title,
        description: (jobRequest.description || jobRequest.title).slice(0, 500),
        category: jobRequest.category,
        minPrice: price,
        maxPrice: jobRequest.budgetMax ?? price,
        duration: 60,
        isActive: false,
      },
    });
  }

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
      // Tarea sets the labour price; a pro cannot bid it up or change it.
      totalPrice: price,
      materialsEstimate: application.materialsEstimate ?? jobRequest.materialsCost ?? 0,
    },
  });

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

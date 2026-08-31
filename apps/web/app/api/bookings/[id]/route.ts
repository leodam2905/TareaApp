import { createNotification } from "@/lib/notify";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { responseDeadlineFromNow } from "@/lib/booking-deadlines";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { completeBooking } from "@/lib/complete-booking";
import { chargeSavedCardForBooking } from "@/lib/booking-charge";
import { canCall, releaseProxySessions } from "@/lib/voice";
import { handymanNet, CUSTOMER_FEE_RATE } from "@/lib/fees";
import { validateMaterials } from "@/lib/materials-policy";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      service: true,
      customer: { select: { id: true, name: true, avatarUrl: true, phone: true } },
      handyman: { select: { id: true, name: true, avatarUrl: true, phone: true } },
      review: true,
      phases: { orderBy: { startedAt: "asc" } },
      extensions: { orderBy: { createdAt: "desc" } },
      messages: {
        include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
        orderBy: { createdAt: "asc" },
        take: 50,
      },
    },
  });

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.customerId !== user.id && booking.handymanId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Neither party ever receives the other's real number — calls go through a
  // masked proxy (POST /api/bookings/[id]/call). We only advertise whether a
  // call can be placed.
  const { customer, handyman, ...rest } = booking;
  return NextResponse.json({
    ...rest,
    customer: { id: customer.id, name: customer.name, avatarUrl: customer.avatarUrl },
    handyman: { id: handyman.id, name: handyman.name, avatarUrl: handyman.avatarUrl },
    canCall: canCall(booking.status, customer.phone, handyman.phone),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    status, cancelReason, receiptUrl, workDone, timer, materialsActual, materialsReceiptTotal,
    // Set by the PRO when accepting: what they will need for parts. The
    // customer approves the resulting total before any money moves.
    materialsQuote,
    // Set by the CUSTOMER to approve that total and pay.
    approvePrice,
  } = await req.json();
  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      service: { select: { title: true, category: true } },
      customer: { select: { email: true, name: true } },
      handyman: { select: { name: true } },
    },
  });

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (booking.customerId !== user.id && booking.handymanId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Enforce a status state machine: only specific transitions are allowed, and
  // each is restricted to the correct role. Prevents either party from jumping
  // to an arbitrary status (e.g. a customer forcing COMPLETED, or cancelling a
  // job that is already COMPLETED to trigger a refund). Disputes go through the
  // dedicated /dispute route, not here.
  const isHandyman = user.id === booking.handymanId;
  const actorRole: "CUSTOMER" | "HANDYMAN" = isHandyman ? "HANDYMAN" : "CUSTOMER";

  // Pause / resume the on-site timer. Not a status change: the job stays
  // IN_PROGRESS, only the clock stops. Server-side on purpose — if the pro's
  // app owned this, the customer's screen would keep counting through a pause
  // and the two would show different totals for the same job.
  if (timer === "pause" || timer === "resume") {
    if (!isHandyman) return NextResponse.json({ error: "Only the pro can control the timer." }, { status: 403 });
    if (booking.status !== "IN_PROGRESS") return NextResponse.json({ error: "Job is not in progress." }, { status: 409 });

    if (timer === "pause") {
      // Already paused: return success rather than restarting the pause clock,
      // which would discard the time already banked.
      if (booking.pausedAt) return NextResponse.json({ ok: true, pausedAt: booking.pausedAt });
      const updatedBooking = await prisma.booking.update({
        where: { id: params.id },
        data: { pausedAt: new Date() },
      });
      await createNotification({
        userId: booking.customerId,
        title: "Work paused",
        body: `${booking.handyman.name} paused work on "${booking.service.title}". The timer is stopped until they resume.`,
        type: "booking_accepted",
        refId: booking.id,
      });
      return NextResponse.json({ ok: true, pausedAt: updatedBooking.pausedAt });
    }

    if (!booking.pausedAt) return NextResponse.json({ ok: true, pausedAt: null });
    // Bank the paused stretch, then clear the marker. Computed from the stored
    // timestamp rather than anything the client sends.
    const bankedSeconds = Math.max(0, Math.floor((Date.now() - booking.pausedAt.getTime()) / 1000));
    const updatedBooking = await prisma.booking.update({
      where: { id: params.id },
      data: { pausedAt: null, pausedSeconds: { increment: bankedSeconds } },
    });
    await createNotification({
      userId: booking.customerId,
      title: "Work resumed",
      body: `${booking.handyman.name} resumed work on "${booking.service.title}".`,
      type: "booking_accepted",
      refId: booking.id,
    });
    return NextResponse.json({ ok: true, pausedAt: null, pausedSeconds: updatedBooking.pausedSeconds });
  }

  // Pro signals work is finished — not a status change. Starts the 3-day
  // auto-release clock and prompts the customer to confirm + release payment.
  if (workDone === true) {
    if (!isHandyman) return NextResponse.json({ error: "Only the pro can mark work done." }, { status: 403 });
    if (booking.status !== "IN_PROGRESS") return NextResponse.json({ error: "Job is not in progress." }, { status: 409 });

    // The materials receipt belongs HERE, with the pro.
    //
    // It was only accepted on the customer's completion PATCH — described in
    // the schema as "the receipt the customer attaches" — but the pro is the
    // one who bought the materials and holds the receipt. The customer cannot
    // attach what they do not have, so the field was unreachable in practice.
    //
    // Attaching it at work-done also puts it in front of the customer BEFORE
    // they confirm and release payment, which is the only moment checking it
    // can change anything. Materials are prepaid from the pro's estimate at
    // application, so this is the customer's one chance to see what was
    // actually bought.
    const proReceipt = typeof receiptUrl === "string" && receiptUrl ? receiptUrl : undefined;

    // What the materials actually cost. Charged at cost CAPPED AT THE ESTIMATE:
    // under it and the difference goes back to the customer at completion; over
    // it and the pro absorbs it, because the customer agreed to a number before
    // the job and only the pro controls the overrun.
    let actual: number | undefined;
    if (materialsActual !== undefined && materialsActual !== null && materialsActual !== "") {
      const n = Math.round(Number(materialsActual) * 100) / 100;
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: "Materials spend must be a positive amount." }, { status: 400 });
      }
      actual = n;
    }

    // A receipt is REQUIRED once materials were quoted.
    //
    // It was optional, and materialsActual was optional too — "null means no
    // figure was given, and the estimate stands". So the cap-at-estimate rule
    // only ever refunded a customer when a pro volunteered that they had
    // underspent. Quote $150, spend $80, leave the field blank, keep $70.
    const quoted = booking.materialsEstimate ?? 0;
    if (quoted > 0 && !proReceipt && !booking.receiptUrl) {
      return NextResponse.json(
        { error: "Attach a photo of the materials receipt to finish this job." },
        { status: 400 },
      );
    }
    if (quoted > 0 && actual === undefined) {
      return NextResponse.json(
        { error: "Enter what the materials actually cost, as shown on the receipt." },
        { status: 400 },
      );
    }

    // What the model read, if the client ran /api/ai/receipt. Advisory: the
    // refund is computed from the pro's own figure either way.
    const readTotal =
      typeof materialsReceiptTotal === "number" && Number.isFinite(materialsReceiptTotal) && materialsReceiptTotal >= 0
        ? Math.round(materialsReceiptTotal * 100) / 100
        : null;

    // Tolerance absorbs OCR noise and a receipt that includes something small
    // and unrelated; beyond it, a human looks. Deliberately two-sided — a pro
    // who UNDER-reports is not defrauding anyone (they absorb it), but the two
    // figures still disagree, and a booking whose paperwork disagrees with
    // itself is worth an admin's eye either way.
    const TOLERANCE = 2.0;
    let verified: "none" | "verified" | "review" = "none";
    if (quoted > 0 && actual !== undefined) {
      verified =
        readTotal === null ? "review"
        : Math.abs(readTotal - actual) <= TOLERANCE ? "verified"
        : "review";
    }

    await prisma.booking.update({
      where: { id: params.id },
      data: {
        workDoneAt: new Date(),
        ...(proReceipt ? { receiptUrl: proReceipt, receiptUploadedAt: new Date() } : {}),
        ...(actual !== undefined ? { materialsActual: actual } : {}),
        ...(readTotal !== null ? { materialsReceiptTotal: readTotal } : {}),
        materialsVerified: verified,
      },
    });

    if (verified === "review") {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      await Promise.allSettled(admins.map((a) => createNotification({
        userId: a.id,
        title: "Materials receipt needs review",
        body: readTotal === null
          ? `Could not read the receipt on "${booking.service.title}". The pro reported $${actual?.toFixed(2)} against a $${quoted.toFixed(2)} quote.`
          : `Receipt reads $${readTotal.toFixed(2)} but the pro reported $${actual?.toFixed(2)} on "${booking.service.title}".`,
        type: "booking_request",
        refId: params.id,
      })));
    }
    await createNotification({
      userId: booking.customerId,
      title: "Work finished — please confirm",
      body: proReceipt
        ? `${booking.handyman.name} marked "${booking.service.title}" as done and attached a materials receipt. Confirm to release payment — it auto-confirms in 3 days.`
        : `${booking.handyman.name} marked "${booking.service.title}" as done. Confirm to release payment — it auto-confirms in 3 days.`,
      type: "booking_accepted",
      refId: booking.id,
    });
    return NextResponse.json({ ok: true, receiptUrl: proReceipt ?? booking.receiptUrl ?? null });
  }

  // Customer approves the quoted price and pays.
  //
  // Directed bookings used to charge the card automatically the moment the pro
  // accepted. That was fine while the price was fixed at request time, but a
  // pro now names their materials when they accept — so the amount charged
  // could differ from the amount the customer agreed to. Nothing is taken
  // until they have seen the final total and said yes.
  if (approvePrice === true) {
    if (actorRole !== "CUSTOMER") {
      return NextResponse.json({ error: "Only the customer can approve the price." }, { status: 403 });
    }
    if (booking.status !== "ACCEPTED") {
      return NextResponse.json({ error: "This booking is not awaiting your approval." }, { status: 409 });
    }
    if (booking.isPaid) {
      return NextResponse.json({ error: "This booking is already paid." }, { status: 409 });
    }
    const charge = await chargeSavedCardForBooking(params.id);
    if (!charge.ok) {
      // Say what to do, not just that it failed. "no_card" is the one the
      // customer can actually fix, and it is reachable — a card can be removed
      // between requesting the pro and approving the price.
      const message =
        charge.reason === "no_card"
          ? "No card on file. Add a payment method and approve again."
          : charge.reason === "requires_action"
            ? "Your bank needs to confirm this payment. Try again and complete the check."
            : charge.message ?? "Your card was declined. Try another payment method.";
      return NextResponse.json({ error: message, reason: charge.reason }, { status: 402 });
    }
    const paid = await prisma.booking.findUnique({ where: { id: params.id } });
    await createNotification({
      userId: booking.handymanId,
      title: "Payment confirmed ✓",
      body: `${booking.customer?.name ?? "The customer"} approved the price for "${booking.service.title}". You're clear to start.`,
      type: "booking_accepted",
      refId: params.id,
    });
    return NextResponse.json(paid);
  }

  const ALLOWED_TRANSITIONS: Record<string, Record<string, Array<"CUSTOMER" | "HANDYMAN">>> = {
    PENDING: {
      ACCEPTED: ["HANDYMAN"],
      CANCELLED: ["CUSTOMER", "HANDYMAN"],
    },
    ACCEPTED: {
      IN_PROGRESS: ["HANDYMAN"],
      CANCELLED: ["CUSTOMER", "HANDYMAN"],
    },
    IN_PROGRESS: {
      COMPLETED: ["CUSTOMER"],   // customer confirms completion → releases payment
      CANCELLED: ["CUSTOMER", "HANDYMAN"],
    },
  };

  const allowedRoles = ALLOWED_TRANSITIONS[booking.status]?.[status];
  if (!allowedRoles) {
    return NextResponse.json(
      { error: `Cannot change booking from ${booking.status} to ${status}.` },
      { status: 409 }
    );
  }
  if (!allowedRoles.includes(actorRole)) {
    return NextResponse.json(
      { error: `Your role cannot perform this action.` },
      { status: 403 }
    );
  }
  // The pro's materials quote, named when accepting.
  let quotedMaterials: number | undefined;
  if (status === "ACCEPTED" && materialsQuote !== undefined && materialsQuote !== null && materialsQuote !== "") {
    const n = Math.round(Number(materialsQuote) * 100) / 100;
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "Materials must be a positive amount." }, { status: 400 });
    }
    const check = validateMaterials(n);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    quotedMaterials = check.value;
  }

  // A job can only be STARTED once it has been paid for.
  //
  // Only COMPLETED was guarded, so a pro could take an accepted booking to
  // IN_PROGRESS, travel, do the work and mark it done — and only then hit the
  // wall at completion, with no way to be paid for labour already performed.
  // Pay-at-hire exists precisely so a pro knows the money is there before they
  // start; letting them start unpaid gives away the one guarantee it buys.
  if (status === "IN_PROGRESS" && !booking.isPaid) {
    return NextResponse.json(
      { error: "This job has not been paid for yet. You'll be able to start once the customer pays." },
      { status: 409 },
    );
  }

  // A job can only be completed once it has been paid for.
  if (status === "COMPLETED" && !booking.isPaid) {
    return NextResponse.json({ error: "Cannot complete an unpaid booking." }, { status: 409 });
  }

  // COMPLETED is customer-driven — delegate to the shared helper (sets status +
  // completedAt, credits earnings, emails the invoice, and releases escrow to
  // the pro = labor net + full materials). Everything else is a plain update.
  let updated;
  if (status === "COMPLETED") {
    // A job completed while paused would leave pausedAt dangling, so bank the
    // final stretch first and let the elapsed figure settle.
    if (booking.pausedAt) {
      const banked = Math.max(0, Math.floor((Date.now() - booking.pausedAt.getTime()) / 1000));
      await prisma.booking.update({
        where: { id: params.id },
        data: { pausedAt: null, pausedSeconds: { increment: banked } },
      });
    }
    updated = await completeBooking(params.id, {
      receiptUrl: typeof receiptUrl === "string" && receiptUrl ? receiptUrl : undefined,
    });
  } else {
    updated = await prisma.booking.update({
      where: { id: params.id },
      data: {
        status,
        cancelReason,
        // When the handyman accepts, the customer gets 2 hours to approve the
        // final price before auto-cancel.
        ...(status === "ACCEPTED" && { responseDeadline: responseDeadlineFromNow() }),
        // Materials the pro says the job needs, named at acceptance. This is
        // what turns the request price into a final one, so it is the number
        // the customer is then asked to approve.
        ...(status === "ACCEPTED" && quotedMaterials !== undefined
          ? { materialsEstimate: quotedMaterials }
          : {}),
        ...(status === "IN_PROGRESS" && !booking.jobStartedAt && { jobStartedAt: new Date() }),
      },
    });
  }

  // Accepting no longer charges. It asks.
  //
  // The card used to be charged the instant the pro accepted, using the
  // off-session consent taken at request time. That worked while the price was
  // settled up front — but a pro now names their materials when they accept, so
  // the amount would differ from the amount the customer agreed to. Charging a
  // saved card for a number the customer has not seen is the wrong side of the
  // line, however small the difference.
  //
  // So acceptance produces a final price and a request for approval. The
  // customer approves (approvePrice above) and is charged, or declines, or lets
  // the 2-hour deadline pass and expire-bookings cancels it — no charge in
  // either of the last two.
  if (status === "ACCEPTED" && !booking.isPaid) {
    const labour = booking.totalPrice;
    const materials = quotedMaterials ?? booking.materialsEstimate ?? 0;
    const finalTotal = Math.round((labour * (1 + CUSTOMER_FEE_RATE) + materials) * 100) / 100;
    await createNotification({
      userId: booking.customerId,
      title: `Approve $${finalTotal.toFixed(2)} to confirm`,
      body: materials > 0
        ? `${booking.handyman?.name ?? "Your pro"} accepted "${booking.service.title}" and quoted $${materials.toFixed(2)} for materials. Approve $${finalTotal.toFixed(2)} to confirm — you're not charged until you do.`
        : `${booking.handyman?.name ?? "Your pro"} accepted "${booking.service.title}". Approve $${finalTotal.toFixed(2)} to confirm — you're not charged until you do.`,
      type: "booking_accepted",
      refId: params.id,
    });
    // Re-read so the response carries the materials quote just written.
    updated = (await prisma.booking.findUnique({ where: { id: params.id } })) ?? updated;
  }

  // Cancellation penalties
  let refundNote = "";
  if (status === "CANCELLED" && booking.isPaid && booking.stripePaymentIntentId) {
    try {
      const hoursUntil = (booking.scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);
      const cancelledByHandyman = user.id === booking.handymanId;

      if (cancelledByHandyman || hoursUntil >= 24) {
        // Handyman cancels any time, OR customer cancels >24h before: full refund
        await stripe.refunds.create({ payment_intent: booking.stripePaymentIntentId });
        refundNote = cancelledByHandyman
          ? " The handyman cancelled — you have been fully refunded. Refund arrives within 5-10 days."
          : " Full refund issued within 5-10 days.";
      } else {
        // Customer cancels <24h before: 50% refund, handyman keeps 50% of their net
        const refundAmount = Math.round(booking.totalPrice * (1 + CUSTOMER_FEE_RATE) * 0.50 * 100);
        await stripe.refunds.create({
          payment_intent: booking.stripePaymentIntentId,
          amount: refundAmount,
        });
        refundNote = " Late cancellation fee applied (within 24h). 50% refund issued within 5-10 days.";

        const handymanUser = await prisma.user.findUnique({ where: { id: booking.handymanId } });
        if (handymanUser?.stripeAccountId && handymanUser.stripeAccountStatus === "active") {
          try {
            // 0.90 was HANDYMAN_FEE_RATE written out by hand, so a change to the
              // fee would silently miss this payout. No materials: the job never
              // happened, so the pro bought nothing to be reimbursed for.
              const handymanAmount = Math.round(handymanNet(booking.totalPrice) * 0.50 * 100);
            await stripe.transfers.create({
              amount: handymanAmount,
              currency: "usd",
              destination: handymanUser.stripeAccountId,
              transfer_group: booking.id,
            });
          } catch (err) {
            console.error("[bookings/PATCH] Late-cancel handyman transfer failed:", err);
          }
        }
      }
    } catch (err) {
      console.error("[bookings/PATCH] Refund failed:", err);
    }
  }

  if (status === "CANCELLED") {
    // Contact closes with the engagement — hand the proxy number back to the pool.
    await releaseProxySessions(params.id);

    const cancelledByHandyman = user.id === booking.handymanId;
    const hoursUntil = (booking.scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);
    const isLate = hoursUntil < 24;
    const handymanNet50 = (handymanNet(booking.totalPrice) * 0.50).toFixed(2);

    if (cancelledByHandyman) {
      // Notify customer — full refund
      await createNotification({
        userId: booking.customerId,
        title: "Booking cancelled by handyman",
        body: `${booking.handyman.name} cancelled your booking for "${booking.service.title}". You have been fully refunded — arrives within 5-10 days.`,
        type: "booking_cancelled",
        refId: booking.id,
      });
      // Notify handyman — forfeit
      await createNotification({
        userId: booking.handymanId,
        title: "You cancelled a booking",
        body: `You cancelled "${booking.service.title}". The customer has been fully refunded. No earnings will be paid for this job.`,
        type: "booking_cancelled",
        refId: booking.id,
      });
    } else {
      // Customer cancelled
      if (isLate && booking.isPaid) {
        // Late cancellation — customer penalised, handyman compensated
        await createNotification({
          userId: booking.customerId,
          title: "Booking cancelled — late fee applied",
          body: `You cancelled "${booking.service.title}" within 24h of the job. A 50% cancellation fee applies — 50% refund issued within 5-10 days.`,
          type: "booking_cancelled",
          refId: booking.id,
        });
        await createNotification({
          userId: booking.handymanId,
          title: "Customer cancelled last minute",
          body: `The customer cancelled "${booking.service.title}" within 24h. Because of the late notice, you'll receive $${handymanNet50} as compensation.`,
          type: "booking_cancelled",
          refId: booking.id,
        });
      } else {
        // Early cancellation — full refund, handyman gets nothing
        await createNotification({
          userId: booking.customerId,
          title: "Booking cancelled",
          body: `You cancelled "${booking.service.title}". Full refund issued within 5-10 days.`,
          type: "booking_cancelled",
          refId: booking.id,
        });
        await createNotification({
          userId: booking.handymanId,
          title: "Customer cancelled their booking",
          body: `The customer cancelled "${booking.service.title}" with more than 24h notice. No compensation applies for early cancellations.`,
          type: "booking_cancelled",
          refId: booking.id,
        });
      }
    }
  } else {
    const notifyUserId = user.id === booking.customerId ? booking.handymanId : booking.customerId;

    // ACCEPTED is announced above, by the notification that carries the final
    // price and asks for approval. A second "payment required" on top of it
    // would say a different thing about the same event.
    if (status !== "ACCEPTED") {
      await createNotification({
        userId: notifyUserId,
        title: `Booking ${status.toLowerCase()}`,
        body: `Your booking has been marked as ${status.toLowerCase()}.`,
        type: "booking_accepted",
        refId: booking.id,
      });
    }
  }

  return NextResponse.json(updated);
}

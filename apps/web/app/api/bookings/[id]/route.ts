import { createNotification } from "@/lib/notify";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { responseDeadlineFromNow } from "@/lib/booking-deadlines";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { completeBooking } from "@/lib/complete-booking";
import { chargeSavedCardForBooking } from "@/lib/booking-charge";
import { canCall, releaseProxySessions } from "@/lib/voice";
import { handymanNet } from "@/lib/fees";

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

  const { status, cancelReason, receiptUrl, workDone, timer } = await req.json();
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
    await prisma.booking.update({ where: { id: params.id }, data: { workDoneAt: new Date() } });
    await createNotification({
      userId: booking.customerId,
      title: "Work finished — please confirm",
      body: `${booking.handyman.name} marked "${booking.service.title}" as done. Confirm to release payment — it auto-confirms in 3 days.`,
      type: "booking_accepted",
      refId: booking.id,
    });
    return NextResponse.json({ ok: true });
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
        // When handyman accepts, give customer 2 hours to pay before auto-cancel
        ...(status === "ACCEPTED" && { responseDeadline: responseDeadlineFromNow() }),
        ...(status === "IN_PROGRESS" && !booking.jobStartedAt && { jobStartedAt: new Date() }),
      },
    });
  }

  // The pro accepting is what finalises a directed booking, so take the money
  // now rather than sending the customer to a payment page they may never open.
  // The card was saved with off-session consent when they hired (see
  // PaymentMethods.ensureCardOnFile / /api/stripe/setup-intent), so no customer
  // action is needed and the pro's accept becomes a paid job within seconds.
  //
  // A failure here is not fatal: the booking stays accepted-but-unpaid and the
  // customer is asked to pay by hand, exactly as before, with the 2-hour
  // deadline and expire-bookings cron as the backstop.
  let chargedOnAccept = false;
  if (status === "ACCEPTED" && !booking.isPaid) {
    const charge = await chargeSavedCardForBooking(params.id);
    chargedOnAccept = charge.ok;
    if (!charge.ok && charge.reason !== "no_card") {
      console.warn("[bookings/PATCH] Accept-time charge failed:", params.id, charge.reason);
    }
    // The row was read before the charge, so re-read it: the pro who just
    // accepted should see a paid job, not a stale "awaiting payment".
    if (chargedOnAccept) {
      updated = (await prisma.booking.findUnique({ where: { id: params.id } })) ?? updated;
    }
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
        const refundAmount = Math.round(booking.totalPrice * 1.15 * 0.50 * 100);
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

    // A booking paid on acceptance is already announced to both parties by
    // markBookingPaid — saying "payment required" on top of it would be wrong
    // and alarming.
    if (!(status === "ACCEPTED" && chargedOnAccept)) {
      const acceptBody = user.role === "HANDYMAN" && status === "ACCEPTED"
        ? "Your booking was accepted! Open your bookings to complete payment."
        : `Your booking has been marked as ${status.toLowerCase()}.`;
      await createNotification({
        userId: notifyUserId,
        title: status === "ACCEPTED" ? "Booking accepted — payment required" : `Booking ${status.toLowerCase()}`,
        body: acceptBody,
        type: "booking_accepted",
        refId: booking.id,
      });
    }
  }

  return NextResponse.json(updated);
}

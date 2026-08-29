import { createNotification } from "@/lib/notify";
import { grossMinimum } from "@/lib/pricing-config";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MATERIALS_MAX } from "@/lib/materials-policy";
import { prisma } from "@/lib/prisma";
import { responseDeadlineFromNow } from "@/lib/booking-deadlines";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { assertPromoUsable, hasPriorPaidOrder } from "@/lib/promo";
import { canCall } from "@/lib/voice";

const createSchema = z.object({
  // Optional: a customer requesting a pro from their profile has not chosen a
  // service row, and should not have to. Resolved below from the category, or
  // the pro's first active service.
  serviceId: z.string().optional(),
  category: z.string().optional(),
  handymanUserId: z.string(),
  scheduledAt: z.string().datetime(),
  address: z.string().min(5),
  city: z.string().min(2),
  notes: z.string().optional(),
  // The app sends the job text as `description`; zod stripped it silently, so
  // everything the customer wrote about the job was thrown away.
  description: z.string().optional(),
  // Optional: without a price the service's own minimum applies. Requiring it
  // meant "request this pro" failed outright whenever no estimate had been run.
  totalPrice: z.number().positive().optional(),
  materialsEstimate: z.number().min(0).max(MATERIALS_MAX).optional(),
  promoCode: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  // A dual-role account has bookings on both sides. The app passes `role` to say
  // which side it wants: the Home app requests `role=customer`, the Pro app
  // `role=handyman`. Falls back to the stored role for older clients.
  const roleParam = searchParams.get("role");
  const viewAsHandyman = roleParam ? roleParam === "handyman" : user.role === "HANDYMAN";
  const where: Record<string, unknown> = viewAsHandyman
    ? { handymanId: user.id }
    : { customerId: user.id };

  if (status) where.status = status;

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      service: { select: { title: true, category: true, imageUrl: true } },
      customer: { select: { name: true, avatarUrl: true, phone: true } },
      handyman: { select: { name: true, avatarUrl: true, phone: true } },
      review: true,
      // Only the pending ones, and only their ids: the customer's activity list
      // needs to know an extension is AWAITING them, not the whole record.
      extensions: { where: { status: "PENDING" }, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Strip the real numbers — calls are placed through a masked proxy, so the
  // client only needs to know whether a call can be placed.
  return NextResponse.json(
    bookings.map(({ customer, handyman, ...rest }) => ({
      ...rest,
      customer: { name: customer.name, avatarUrl: customer.avatarUrl },
      handyman: { name: handyman.name, avatarUrl: handyman.avatarUrl },
      canCall: canCall(rest.status, customer.phone, handyman.phone),
    }))
  );
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`booking:${user.id}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many booking requests. Please wait a moment." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    // A dual-role account can hire, but not itself.
    if (data.handymanUserId === user.id) {
      return NextResponse.json({ error: "You can't book yourself." }, { status: 400 });
    }

    // Resolve the service when the client did not name one.
    //
    // Booking a pro from their profile sends no serviceId — the customer picked
    // a person, not a row in a table. Prefer a service matching the category
    // they chose, and otherwise take the pro's first active one.
    const service = data.serviceId
      ? await prisma.service.findUnique({
          where: { id: data.serviceId },
          select: { id: true, minPrice: true, maxPrice: true, isActive: true, handyman: { select: { userId: true } } },
        })
      : await prisma.service.findFirst({
          where: {
            isActive: true,
            handyman: { userId: data.handymanUserId },
            ...(data.category ? { category: data.category as never } : {}),
          },
          select: { id: true, minPrice: true, maxPrice: true, isActive: true, handyman: { select: { userId: true } } },
          orderBy: { minPrice: "asc" },
        });
    if (!service || !service.isActive) {
      return NextResponse.json(
        { error: "This pro has no service available for that job." },
        { status: 400 },
      );
    }
    // If the service is owned by a specific handyman, it must match the booking target.
    if (service.handyman && service.handyman.userId !== data.handymanUserId) {
      return NextResponse.json({ error: "Service does not belong to this handyman" }, { status: 400 });
    }
    // No price supplied means the service's own minimum.
    const totalPrice = data.totalPrice ?? service.minPrice;

    // Floor is Tarea's, not the service row's.
    //
    // Prices come from the rate card in lib/pricing-config now — a pro takes a
    // job at the price Tarea sets or does not take it — but this still gated on
    // Service.minPrice/maxPrice, which every pro carries as the seeded $50-$150.
    // So an AI estimate of $200 for a faucet was rejected as out of range and
    // "request this pro" failed outright, which is what a customer hit from
    // Browse Pros.
    //
    // The check that still matters is the floor: it is what stops a crafted
    // request paying $0.01 for a $500 job. Above it, the platform's own quote
    // is authoritative and the service range is advisory.
    const floor = Math.floor(grossMinimum() * 100) / 100;
    const EPS = 0.01;
    if (totalPrice < floor - EPS) {
      return NextResponse.json(
        { error: `The minimum for a job on Tarea is $${floor.toFixed(2)}.` },
        { status: 400 },
      );
    }

    const responseDeadline = responseDeadlineFromNow(); // 2 hours for the pro to accept

    let promoCodeId: string | undefined;
    if (data.promoCode) {
      const promo = await prisma.promoCode.findUnique({
        where: { code: data.promoCode.toUpperCase() },
      });
      const prior = await hasPriorPaidOrder(user.id);
      if (promo && assertPromoUsable(promo, user.id, totalPrice, prior).ok) {
        promoCodeId = promo.id;
        await prisma.promoCode.update({ where: { id: promo.id }, data: { usesCount: { increment: 1 } } });
      }
    }

    const booking = await prisma.booking.create({
      data: {
        customerId: user.id,
        handymanId: data.handymanUserId,
        serviceId: service.id,
        scheduledAt: new Date(data.scheduledAt),
        address: data.address,
        city: data.city,
        // The app sends the job text as `description`; keep either name rather
        // than discarding what the customer wrote.
        notes: data.notes ?? data.description,
        totalPrice,
        materialsEstimate: data.materialsEstimate ?? 0,
        responseDeadline,
        ...(promoCodeId && { promoCodeId }),
      },
    });

    // Notify handyman
    await createNotification({
      userId: data.handymanUserId,
      title: "New Booking Request",
      body: `${user.name} has requested your service.`,
      type: "booking_request",
      refId: booking.id,
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      // Name the field. "Required" on its own told the customer nothing and
      // told whoever was debugging it even less — a booking failing to send
      // looked identical whether the address was short or the date malformed.
      const issue = err.errors[0];
      const field = issue.path.join(".");
      return NextResponse.json(
        { error: field ? `${field}: ${issue.message}` : issue.message, field },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

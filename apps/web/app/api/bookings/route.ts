import { createNotification } from "@/lib/notify";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { responseDeadlineFromNow } from "@/lib/booking-deadlines";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { assertPromoUsable, hasPriorPaidOrder } from "@/lib/promo";
import { canCall } from "@/lib/voice";

const createSchema = z.object({
  serviceId: z.string(),
  handymanUserId: z.string(),
  scheduledAt: z.string().datetime(),
  address: z.string().min(5),
  city: z.string().min(2),
  notes: z.string().optional(),
  totalPrice: z.number().positive(),
  materialsEstimate: z.number().min(0).optional(),
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

    // Authoritative price check: the client-supplied totalPrice must fall within
    // the service's server-side price range. Prevents price tampering (e.g. paying
    // $0.01 for a $500 job). Materials are tracked separately (materialsEstimate).
    const service = await prisma.service.findUnique({
      where: { id: data.serviceId },
      select: { minPrice: true, maxPrice: true, isActive: true, handyman: { select: { userId: true } } },
    });
    if (!service || !service.isActive) {
      return NextResponse.json({ error: "Service not available" }, { status: 400 });
    }
    // If the service is owned by a specific handyman, it must match the booking target.
    if (service.handyman && service.handyman.userId !== data.handymanUserId) {
      return NextResponse.json({ error: "Service does not belong to this handyman" }, { status: 400 });
    }
    // Allow a tiny float tolerance on the bounds.
    const EPS = 0.01;
    if (data.totalPrice < service.minPrice - EPS || data.totalPrice > service.maxPrice + EPS) {
      return NextResponse.json(
        { error: `Price must be between $${service.minPrice} and $${service.maxPrice} for this service.` },
        { status: 400 }
      );
    }

    const responseDeadline = responseDeadlineFromNow(); // 2 hours for the pro to accept

    let promoCodeId: string | undefined;
    if (data.promoCode) {
      const promo = await prisma.promoCode.findUnique({
        where: { code: data.promoCode.toUpperCase() },
      });
      const prior = await hasPriorPaidOrder(user.id);
      if (promo && assertPromoUsable(promo, user.id, data.totalPrice, prior).ok) {
        promoCodeId = promo.id;
        await prisma.promoCode.update({ where: { id: promo.id }, data: { usesCount: { increment: 1 } } });
      }
    }

    const booking = await prisma.booking.create({
      data: {
        customerId: user.id,
        handymanId: data.handymanUserId,
        serviceId: data.serviceId,
        scheduledAt: new Date(data.scheduledAt),
        address: data.address,
        city: data.city,
        notes: data.notes,
        totalPrice: data.totalPrice,
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
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { createNotification } from "@/lib/notify";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

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

  const where: Record<string, unknown> =
    user.role === "HANDYMAN"
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

  return NextResponse.json(bookings);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`booking:${user.id}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many booking requests. Please wait a moment." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const responseDeadline = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    let promoCodeId: string | undefined;
    if (data.promoCode) {
      const promo = await prisma.promoCode.findUnique({
        where: { code: data.promoCode.toUpperCase() },
      });
      const valid = promo &&
        promo.isActive &&
        (!promo.expiresAt || promo.expiresAt > new Date()) &&
        (promo.maxUses === null || promo.usesCount < promo.maxUses);
      if (valid && promo) {
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

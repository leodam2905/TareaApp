import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = headers().get("authorization") ?? "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://taptarea.com";
  const now = new Date();
  let reviewSent = 0;
  let reengageSent = 0;

  // Review request: COMPLETED bookings 48h ago with no review
  const reviewWindow = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const reviewWindowEnd = new Date(now.getTime() - 47 * 60 * 60 * 1000);

  const completedNoReview = await prisma.booking.findMany({
    where: {
      status: "COMPLETED",
      updatedAt: { gte: reviewWindow, lte: reviewWindowEnd },
      review: null,
    },
    include: {
      customer: { select: { name: true, email: true } },
      service: { select: { title: true } },
      handyman: { select: { name: true } },
    },
  });

  for (const booking of completedNoReview) {
    await sendEmail(
      booking.customer.email,
      `How was your experience with ${booking.handyman.name}?`,
      "Share your feedback",
      `You recently booked <strong>${booking.service.title}</strong> with ${booking.handyman.name}. Your review helps other customers find great handymen.`,
      { label: "Leave a Review", url: `${appUrl}/customer/bookings/${booking.id}` },
    ).catch(() => {});
    reviewSent++;
  }

  // Re-engagement: customers with no booking in last 7 days, last seen 7 days ago
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

  const inactiveCustomers = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      isActive: true,
      createdAt: { lte: sevenDaysAgo },
      bookingsAsCustomer: {
        none: { createdAt: { gte: sevenDaysAgo } },
      },
      updatedAt: { gte: eightDaysAgo, lte: sevenDaysAgo },
    },
    select: { id: true, name: true, email: true },
  });

  for (const user of inactiveCustomers) {
    await sendEmail(
      user.email,
      "Your home needs some love 🏡",
      `Miss us, ${user.name.split(" ")[0]}?`,
      "It's been a while since your last booking. Browse our verified handymen and get something done today.",
      { label: "Browse Handymen", url: `${appUrl}/customer/browse` },
    ).catch(() => {});
    reengageSent++;
  }

  return NextResponse.json({ reviewSent, reengageSent });
}

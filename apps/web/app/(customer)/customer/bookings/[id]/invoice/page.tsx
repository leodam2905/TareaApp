import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_FEE_RATE } from "@/lib/fees";
import InvoicePrint from "./InvoicePrint";

export default async function InvoicePage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      service: true,
      customer: { select: { id: true, name: true, email: true, phone: true } },
      handyman: { select: { id: true, name: true, email: true, phone: true } },
    },
  });

  if (!booking) notFound();
  if (booking.customerId !== user.id && user.role !== "ADMIN") redirect("/customer/bookings");
  if (!booking.isPaid) redirect(`/customer/bookings/${params.id}`);

  // Fee applies to the service price only; materials are passed through at cost.
  const serviceFee = Math.round(booking.totalPrice * CUSTOMER_FEE_RATE * 100) / 100;
  const materials = booking.materialsEstimate ?? 0;
  const total = booking.totalPrice + serviceFee + materials;

  return <InvoicePrint booking={booking} serviceFee={serviceFee} materials={materials} total={total} />;
}

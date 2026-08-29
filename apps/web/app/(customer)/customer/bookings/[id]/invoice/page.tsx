import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_FEE_RATE } from "@/lib/fees";
import InvoicePrint from "./InvoicePrint";
import { verifyInvoiceToken } from "@/lib/invoice-link";

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { t?: string };
}) {
  // A signed link from the invoice email stands in for a session.
  //
  // The token is an HMAC over this booking id alone, so it opens this invoice
  // and nothing else. Without it a customer who lives in the app was asked to
  // create a website login to read a receipt for money they had already paid.
  const emailed = verifyInvoiceToken(params.id, searchParams?.t);
  const user = await getCurrentUser();
  if (!user && !emailed) redirect("/login");

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      service: true,
      customer: { select: { id: true, name: true, email: true, phone: true } },
      handyman: { select: { id: true, name: true, email: true } },
    },
  });

  if (!booking) notFound();
  // A valid token already proves the bearer was sent this invoice.
  if (!emailed && booking.customerId !== user!.id && user!.role !== "ADMIN") {
    redirect("/customer/bookings");
  }
  if (!booking.isPaid) redirect(`/customer/bookings/${params.id}`);

  // Fee applies to the service price only; materials are passed through at cost.
  const serviceFee = Math.round(booking.totalPrice * CUSTOMER_FEE_RATE * 100) / 100;
  // The estimate is what was CHARGED at hire, so the invoice lists it and shows
  // the refund as its own credit line. Netting the two into one smaller number
  // would leave a customer unable to match this against a card statement that
  // shows the charge and the refund as two separate entries.
  const materials = booking.materialsEstimate ?? 0;
  const refunded = booking.materialsRefunded ?? 0;
  const total = Math.round((booking.totalPrice + serviceFee + materials - refunded) * 100) / 100;

  return (
    <InvoicePrint
      booking={booking}
      serviceFee={serviceFee}
      materials={materials}
      materialsRefunded={refunded}
      total={total}
    />
  );
}

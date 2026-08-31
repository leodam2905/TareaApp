import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_FEE_RATE } from "@/lib/fees";
import { proIdentity } from "@/lib/invoice-config";
import { verifyInvoiceToken } from "@/lib/invoice-link";
import InvoicePrint from "../../(customer)/customer/bookings/[id]/invoice/InvoicePrint";

export const dynamic = "force-dynamic";

// The receipt, reachable by a signed link alone.
//
// The original invoice page lives under /customer, whose LAYOUT redirects any
// unauthenticated request to /login — and a layout receives no searchParams, so
// it cannot know the request carries a valid token. It fired before the page
// could check, which is why an emailed invoice still demanded a website login.
//
// So the shareable receipt lives here instead, outside that layout and outside
// the middleware matcher. The token is the whole authorisation: it is an HMAC
// over one booking id, so it opens that receipt and nothing else.
export default async function PublicInvoicePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { t?: string };
}) {
  if (!verifyInvoiceToken(params.id, searchParams?.t)) notFound();

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      service: true,
      customer: { select: { id: true, name: true, email: true, phone: true } },
      handyman: {
        select: {
          id: true, name: true, email: true,
          accountType: true, companyName: true,
          // Printed as the performer of the work — see proIdentity().
          handymanProfile: {
            select: {
              licenseNumber: true, licenseeName: true,
              licenseIssuer: true, licenseStatus: true,
            },
          },
        },
      },
    },
  });
  if (!booking || !booking.isPaid) notFound();

  const serviceFee = Math.round(booking.totalPrice * CUSTOMER_FEE_RATE * 100) / 100;
  const materials = booking.materialsEstimate ?? 0;
  const refunded = booking.materialsRefunded ?? 0;
  const total = Math.round((booking.totalPrice + serviceFee + materials - refunded) * 100) / 100;
  // The name on the invoice is the pro's trading name and, where verified,
  // their licence — not the account's display name. See lib/invoice-config.
  const pro = proIdentity({
    name: booking.handyman.name,
    accountType: booking.handyman.accountType,
    companyName: booking.handyman.companyName,
    ...(booking.handyman.handymanProfile ?? {}),
  });


  return (
    <InvoicePrint
      pro={pro}
      booking={booking}
      serviceFee={serviceFee}
      materials={materials}
      materialsRefunded={refunded}
      total={total}
    />
  );
}

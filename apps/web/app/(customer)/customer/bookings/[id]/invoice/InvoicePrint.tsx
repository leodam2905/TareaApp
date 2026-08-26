"use client";

import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CUSTOMER_FEE_RATE } from "@/lib/fees";
import Logo from "@/components/ui/Logo";

type Booking = {
  id: string;
  totalPrice: number;
  scheduledAt: Date;
  address: string;
  city: string;
  createdAt: Date;
  stripePaymentIntentId: string | null;
  service: { title: string; category: string };
  customer: { name: string; email: string; phone: string | null };
  handyman: { name: string; email: string };
};

export default function InvoicePrint({
  booking,
  serviceFee,
  materials = 0,
  total,
}: {
  booking: Booking;
  serviceFee: number;
  materials?: number;
  total: number;
}) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const invoiceNum = `INV-${booking.id.slice(-8).toUpperCase()}`;
  const paidDate = new Date(booking.scheduledAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const issuedDate = new Date(booking.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      {/* Print controls — hidden when printing */}
      <div className="print:hidden flex items-center gap-3 mb-6 max-w-3xl mx-auto px-4">
        <Link
          href={`/customer/bookings/${booking.id}`}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to booking
        </Link>
        <button
          onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 bg-tarea-sky text-tarea-ink font-bold px-5 py-2.5 rounded-xl hover:bg-sky-300 transition-all text-sm"
        >
          <Printer className="w-4 h-4" />
          Download / Print PDF
        </button>
      </div>

      {/* Invoice body */}
      <div className="max-w-3xl mx-auto px-4 print:px-0 print:max-w-none">
        <div
          id="invoice"
          className="bg-white text-gray-900 rounded-2xl print:rounded-none shadow-2xl print:shadow-none p-8 md:p-12 print:p-10 font-sans"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-10">
            <div>
              <Logo size={44} />
              <p className="text-sm text-gray-500 mt-0.5">taptarea.com</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">Invoice</p>
              <p className="text-sm text-gray-500 mt-1">{invoiceNum}</p>
              <p className="text-xs text-gray-400 mt-0.5">Issued {issuedDate}</p>
            </div>
          </div>

          {/* Bill To / Service By */}
          <div className="grid grid-cols-2 gap-8 mb-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Bill To</p>
              <p className="font-bold text-gray-900">{booking.customer.name}</p>
              <p className="text-sm text-gray-600">{booking.customer.email}</p>
              {booking.customer.phone && (
                <p className="text-sm text-gray-600">{booking.customer.phone}</p>
              )}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Service Provider</p>
              <p className="font-bold text-gray-900">{booking.handyman.name}</p>
              {/* The pro's phone is deliberately omitted — contact goes through
                  the masked proxy, and the invoice would otherwise leak it. */}
              <p className="text-sm text-gray-600">{booking.handyman.email}</p>
            </div>
          </div>

          {/* Service details */}
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Service Details</p>
            <div className="bg-tarea-paper rounded-xl p-4 text-sm text-gray-700 grid grid-cols-2 gap-x-8 gap-y-2">
              <div>
                <span className="text-gray-400">Service: </span>
                <span className="font-semibold text-gray-900">{booking.service.title}</span>
              </div>
              <div>
                <span className="text-gray-400">Date: </span>
                <span className="font-semibold text-gray-900">{paidDate}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-400">Location: </span>
                <span className="font-semibold text-gray-900">
                  {booking.address}, {booking.city}
                </span>
              </div>
              {booking.stripePaymentIntentId && (
                <div className="col-span-2">
                  <span className="text-gray-400">Payment ID: </span>
                  <span className="font-mono text-xs text-gray-600">{booking.stripePaymentIntentId}</span>
                </div>
              )}
            </div>
          </div>

          {/* Line items */}
          <table className="w-full text-sm mb-8">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left text-xs font-bold uppercase tracking-wider text-gray-400 pb-2">Description</th>
                <th className="text-right text-xs font-bold uppercase tracking-wider text-gray-400 pb-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-3">
                  <p className="font-semibold text-gray-900">{booking.service.title}</p>
                  <p className="text-xs text-gray-500">Professional service fee</p>
                </td>
                <td className="py-3 text-right font-semibold text-gray-900">{fmt(booking.totalPrice)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3">
                  <p className="font-semibold text-gray-900">Service Fee</p>
                  <p className="text-xs text-gray-500">{Math.round(CUSTOMER_FEE_RATE * 100)}% of service price</p>
                </td>
                <td className="py-3 text-right font-semibold text-gray-900">{fmt(serviceFee)}</td>
              </tr>
              {materials > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="py-3">
                    <p className="font-semibold text-gray-900">Materials</p>
                    <p className="text-xs text-gray-500">Passed through at cost — no fee</p>
                  </td>
                  <td className="py-3 text-right font-semibold text-gray-900">{fmt(materials)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-4 font-bold text-gray-900">Total Charged</td>
                <td className="pt-4 text-right font-extrabold text-xl text-gray-900">{fmt(total)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Paid stamp */}
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 mb-10">
            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-emerald-700 text-sm">Payment Confirmed</p>
              <p className="text-emerald-600 text-xs">Processed securely via Stripe</p>
            </div>
            <p className="ml-auto font-bold text-emerald-700 text-sm">{fmt(total)}</p>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 pt-6 text-xs text-gray-400 text-center space-y-1">
            <p>Tarea US LLC · taptarea.com · support@taptarea.com</p>
            <p>This invoice is auto-generated and serves as your official payment receipt.</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          #invoice { box-shadow: none !important; }
        }
      `}</style>
    </>
  );
}

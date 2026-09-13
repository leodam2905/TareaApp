"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ExternalLink, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

/// Both sides of every booking's money on one row.
///
/// The numbers already existed -- they were just spread across /admin/bookings,
/// the payouts page and the Stripe dashboard, so "where did this customer's
/// money go?" meant holding three screens in your head.
interface MoneyRow {
  id: string;
  createdAt: string;
  status: string;
  service: string | null;
  customer: { id: string; name: string };
  handyman: { id: string; name: string };
  in: { charged: number; isPaid: boolean; paymentIntent: string | null };
  out: {
    proShare: number; paid: boolean; amount: number | null;
    at: string | null; transferId: string | null; onHold: boolean;
  };
  tips: { total: number; unpaid: number };
  feeRetained: number;
  chargeback: string | null;
}

export default function AdminMoneyPage() {
  const [rows, setRows] = useState<MoneyRow[]>([]);
  const [totals, setTotals] = useState({ chargedIn: 0, paidOut: 0, feeRetained: 0, owedOut: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/money")
      .then(r => r.json())
      .then(d => { setRows(d.rows ?? []); if (d.totals) setTotals(d.totals); })
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: "Collected from customers", value: totals.chargedIn, tone: "text-sky-400", icon: ArrowDownLeft },
    { label: "Paid to pros", value: totals.paidOut, tone: "text-emerald-400", icon: ArrowUpRight },
    { label: "Still owed to pros", value: totals.owedOut, tone: "text-amber-400", icon: ArrowUpRight },
    { label: "Fee retained", value: totals.feeRetained, tone: "text-white", icon: ArrowDownLeft },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Money</h1>
        <p className="text-slate-400 mt-1">Every booking, both sides — what came in and what went out</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <p className="text-slate-400 text-sm mb-1 flex items-center gap-1">
              <c.icon className="w-3.5 h-3.5" /> {c.label}
            </p>
            <p className={`${c.tone} font-extrabold text-2xl`}>{formatCurrency(c.value)}</p>
          </div>
        ))}
      </div>

      {loading && <p className="text-slate-400">Loading...</p>}

      {!loading && rows.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <p className="text-white font-bold text-lg">No bookings yet</p>
        </div>
      )}

      {/* Scrolls inside itself: the page must never scroll sideways. */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-slate-400 text-left border-b border-white/10">
              <th className="py-2 pr-4 font-semibold">Booking</th>
              <th className="py-2 pr-4 font-semibold">Customer → Pro</th>
              <th className="py-2 pr-4 font-semibold text-right">In</th>
              <th className="py-2 pr-4 font-semibold text-right">Fee</th>
              <th className="py-2 pr-4 font-semibold text-right">Out</th>
              <th className="py-2 pr-4 font-semibold">Stripe</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-white/5">
                <td className="py-3 pr-4">
                  <p className="text-white font-semibold">{r.service ?? "—"}</p>
                  <p className="text-slate-500 text-xs">{new Date(r.createdAt).toLocaleDateString()} · {r.status}</p>
                  {r.chargeback && (
                    <p className="text-red-400 text-xs inline-flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> chargeback {r.chargeback}
                    </p>
                  )}
                </td>
                <td className="py-3 pr-4 text-slate-300">
                  {r.customer.name} <span className="text-slate-600">→</span> {r.handyman.name}
                </td>
                <td className="py-3 pr-4 text-right">
                  <span className={r.in.isPaid ? "text-sky-400 font-bold" : "text-slate-500"}>
                    {formatCurrency(r.in.charged)}
                  </span>
                  {r.tips.total > 0 && (
                    <p className="text-slate-500 text-xs">+{formatCurrency(r.tips.total)} tip</p>
                  )}
                </td>
                <td className="py-3 pr-4 text-right text-slate-300">{formatCurrency(r.feeRetained)}</td>
                <td className="py-3 pr-4 text-right">
                  {r.out.paid ? (
                    <span className="text-emerald-400 font-bold">
                      {r.out.amount != null ? formatCurrency(r.out.amount) : "paid"}
                    </span>
                  ) : r.out.onHold ? (
                    <span className="text-red-400">on hold</span>
                  ) : (
                    <span className="text-amber-400">{formatCurrency(r.out.proShare)} owed</span>
                  )}
                  {r.tips.unpaid > 0 && (
                    <p className="text-amber-400/70 text-xs">+{formatCurrency(r.tips.unpaid)} tip owed</p>
                  )}
                </td>
                <td className="py-3 pr-4 space-y-1">
                  {r.in.paymentIntent && (
                    <a
                      href={`https://dashboard.stripe.com/payments/${r.in.paymentIntent}`}
                      target="_blank" rel="noreferrer"
                      className="text-sky-400 text-xs flex items-center gap-1 hover:underline"
                    >
                      charge <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {r.out.transferId ? (
                    <a
                      href={`https://dashboard.stripe.com/transfers/${r.out.transferId}`}
                      target="_blank" rel="noreferrer"
                      className="text-emerald-400 text-xs flex items-center gap-1 hover:underline"
                    >
                      transfer <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : r.out.paid ? (
                    <span className="text-amber-400/70 text-xs">paid before tracking</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

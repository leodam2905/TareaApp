"use client";

import { useEffect, useState } from "react";
import { DollarSign, Zap, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";

interface HandymanPayout {
  handyman: { id: string; name: string; email: string; stripeAccountId: string | null; stripeAccountStatus: string | null };
  bookings: { id: string; totalPrice: number; completedAt: string | null; service: { title: string } }[];
  totalOwed: number;
  canAutoPay: boolean;
}

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<HandymanPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/payouts")
      .then(r => r.json())
      .then(data => setPayouts(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const triggerPayout = async (handymanId: string, name: string) => {
    setPaying(handymanId);
    const res = await fetch(`/api/admin/payouts/${handymanId}`, { method: "POST" });
    const body = await res.json();
    if (res.ok) {
      toast.success(`Paid ${name} — ${formatCurrency(body.amount)} for ${body.count} bookings`);
      load();
    } else {
      toast.error(body.error || "Payout failed");
    }
    setPaying(null);
  };

  const totalPending = payouts.reduce((s, p) => s + p.totalOwed, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Payouts</h1>
        <p className="text-slate-400 mt-1">Manage handyman earnings and disbursements</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-slate-400 text-sm mb-1">Total Pending Payouts</p>
          <p className="text-emerald-400 font-extrabold text-2xl">{formatCurrency(totalPending)}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-slate-400 text-sm mb-1">Handymen Awaiting Payment</p>
          <p className="text-white font-extrabold text-2xl">{payouts.length}</p>
        </div>
      </div>

      {loading && <p className="text-slate-400">Loading...</p>}

      {!loading && payouts.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <DollarSign className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <p className="text-white font-bold text-lg">All caught up</p>
          <p className="text-slate-400 text-sm mt-1">No pending payouts at this time.</p>
        </div>
      )}

      <div className="space-y-4">
        {payouts.map(p => (
          <div key={p.handyman.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-white font-bold">{p.handyman.name}</p>
                <p className="text-slate-400 text-sm">{p.handyman.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  {p.canAutoPay ? (
                    <span className="text-xs text-emerald-400 font-semibold bg-emerald-400/10 px-2 py-0.5 rounded-full">Stripe Connected</span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-yellow-400 font-semibold bg-yellow-400/10 px-2 py-0.5 rounded-full">
                      <AlertCircle className="w-3 h-3" /> No Stripe account
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-emerald-400 font-extrabold text-xl">{formatCurrency(p.totalOwed)}</p>
                <p className="text-slate-400 text-xs">{p.bookings.length} booking{p.bookings.length !== 1 ? "s" : ""}</p>
              </div>
            </div>

            {/* Booking list */}
            <div className="bg-white/5 rounded-xl overflow-hidden">
              {p.bookings.map((b, i) => (
                <div key={b.id} className={`flex items-center justify-between px-4 py-3 text-sm ${i < p.bookings.length - 1 ? "border-b border-white/5" : ""}`}>
                  <span className="text-slate-300">{b.service.title}</span>
                  <span className="text-emerald-400 font-semibold">{formatCurrency(b.totalPrice * 0.9)}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => triggerPayout(p.handyman.id, p.handyman.name)}
              disabled={!p.canAutoPay || paying === p.handyman.id}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-tarea-sky/10 border border-tarea-sky/30 rounded-xl text-tarea-sky font-semibold text-sm hover:bg-tarea-sky/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Zap className="w-4 h-4" />
              {paying === p.handyman.id ? "Sending…" : p.canAutoPay ? "Send Payout via Stripe" : "Handyman must connect Stripe first"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

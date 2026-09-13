"use client";

import { useEffect, useState } from "react";
import { DollarSign, Zap, AlertCircle, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";

interface PaidTransfer {
  transferId: string | null;
  paidAt: string | null;
  /// False for payouts made before migration 020, which have no transfer id.
  /// Shown and labelled rather than hidden -- they are real payments.
  tracked: boolean;
  handyman: { id: string; name: string; email: string };
  amount: number;
  bookings: { id: string; totalPrice: number; payoutAmount: number | null; service: { title: string } | null }[];
}

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
  // "Owed" was the only view: nothing here ever showed what had actually been
  // paid, which meant opening Stripe and matching transfers to pros by hand.
  const [tab, setTab] = useState<"owed" | "paid">("owed");
  const [history, setHistory] = useState<PaidTransfer[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/payouts")
      .then(r => r.json())
      .then(data => setPayouts(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (tab !== "paid" || history.length) return;
    setHistoryLoading(true);
    fetch("/api/admin/payouts/history")
      .then(r => r.json())
      .then(d => setHistory(Array.isArray(d?.transfers) ? d.transfers : []))
      .finally(() => setHistoryLoading(false));
  }, [tab, history.length]);

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

      {/* Owed vs paid. The second half did not exist before: this page could
          only say who was still owed, never what had already gone out. */}
      <div className="flex gap-2">
        {(["owed", "paid"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
              tab === t ? "bg-emerald-500 text-slate-900" : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {t === "owed" ? "Owed" : "Paid"}
          </button>
        ))}
      </div>

      {tab === "paid" && (
        <div className="space-y-4">
          {historyLoading && <p className="text-slate-400">Loading history...</p>}
          {!historyLoading && history.length === 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
              <DollarSign className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <p className="text-white font-bold text-lg">No payouts recorded</p>
              <p className="text-slate-400 text-sm mt-1">Transfers appear here once a payout is made.</p>
            </div>
          )}
          {history.map((t, i) => (
            <div key={t.transferId ?? `untracked-${t.handyman.id}-${i}`} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-white font-bold">{t.handyman.name}</p>
                  <p className="text-slate-400 text-sm">{t.handyman.email}</p>
                  <p className="text-slate-400 text-xs mt-2">
                    {t.paidAt ? new Date(t.paidAt).toLocaleString() : "date not recorded"}
                    {" · "}
                    {t.bookings.length} booking{t.bookings.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-emerald-400 font-extrabold text-xl">
                    {t.tracked ? formatCurrency(t.amount) : "—"}
                  </p>
                  {t.tracked ? (
                    <a
                      href={`https://dashboard.stripe.com/transfers/${t.transferId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 text-xs inline-flex items-center gap-1 hover:underline"
                    >
                      {t.transferId} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <p className="text-amber-400/80 text-xs">paid before tracking</p>
                  )}
                </div>
              </div>
              <div className="mt-4 space-y-1">
                {t.bookings.map(b => (
                  <div key={b.id} className="flex justify-between text-sm text-slate-300">
                    <span>{b.service?.title ?? "—"}</span>
                    <span className="text-slate-400">
                      {b.payoutAmount != null ? formatCurrency(b.payoutAmount) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "owed" && loading && <p className="text-slate-400">Loading...</p>}

      {tab === "owed" && !loading && payouts.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <DollarSign className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <p className="text-white font-bold text-lg">All caught up</p>
          <p className="text-slate-400 text-sm mt-1">No pending payouts at this time.</p>
        </div>
      )}

      <div className={tab === "owed" ? "space-y-4" : "hidden"}>
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

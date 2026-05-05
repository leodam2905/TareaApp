"use client";

import { useState } from "react";
import { Loader2, AlertCircle, CheckCircle2, Zap, CalendarClock } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";

interface Props {
  available: number;
  minCashout: number;
  instantFee: number;
  stripeStatus: string;
}

export default function CashoutButton({ available, minCashout, instantFee, stripeStatus }: Props) {
  const [loading, setLoading] = useState(false);

  const youReceive = available - instantFee;
  const canCashout = available >= minCashout;

  const handleCashout = async () => {
    if (!confirm(
      `Cash out ${formatCurrency(youReceive)} instantly to your debit card?\n\nInstant fee: ${formatCurrency(instantFee)}\nYou receive: ${formatCurrency(youReceive)}\n\nMoney arrives within 30 minutes.`
    )) return;

    setLoading(true);
    try {
      const res = await fetch("/api/handyman/cashout", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${formatCurrency(data.net)} is on its way to your debit card!`, { duration: 5000 });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.error(data.error ?? "Cashout failed");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (stripeStatus !== "active") {
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-white font-semibold mb-1">Set up your payout methods to cash out</p>
            <p className="text-slate-400 text-sm mb-4">
              Add a debit card for instant payouts and a bank account for weekly automatic transfers.
            </p>
            <Link
              href="/handyman/payout-methods"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-all text-sm"
            >
              Set Up Payout Methods
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Instant cashout card */}
      <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-violet-500/20 rounded-2xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-slate-400 text-sm">Cash out now · debit card</p>
                <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">~30 min</span>
              </div>
              <p className="text-3xl font-extrabold text-white">{formatCurrency(available)}</p>
              {canCashout && (
                <p className="text-xs text-slate-400 mt-0.5">
                  After {formatCurrency(instantFee)} fee → <span className="text-violet-300 font-semibold">{formatCurrency(youReceive)}</span> to your card
                </p>
              )}
              {!canCashout && available > 0 && (
                <p className="text-xs text-slate-500 mt-0.5">Minimum {formatCurrency(minCashout)} required</p>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1">
              <CheckCircle2 className="w-3 h-3" />
              Account connected
            </div>
            <button
              onClick={handleCashout}
              disabled={loading || !canCashout}
              className="flex items-center gap-2 px-6 py-2.5 bg-violet-500 hover:bg-violet-400 disabled:bg-violet-500/30 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all text-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Cash Out Instantly
            </button>
          </div>
        </div>
      </div>

      {/* Weekly auto-payout info */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-white/5 border border-white/10 rounded-xl">
        <CalendarClock className="w-4 h-4 text-tarea-sky flex-shrink-0" />
        <p className="text-slate-400 text-sm">
          Any uncashed earnings are <span className="text-white font-medium">automatically sent to your bank account every Monday</span> — free, no action needed.
        </p>
      </div>
    </div>
  );
}

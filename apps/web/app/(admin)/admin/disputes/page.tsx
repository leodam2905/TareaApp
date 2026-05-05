"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { formatDate, formatCurrency } from "@/lib/utils";

interface DisputedBooking {
  id: string; totalPrice: number; disputeReason: string; disputedAt: string;
  isPaid: boolean;
  customer: { name: string; email: string };
  handyman: { name: string; email: string };
  service: { title: string };
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<DisputedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/bookings?status=DISPUTED")
      .then(r => r.json())
      .then(data => setDisputes(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const resolve = async (id: string, decision: "refund" | "release") => {
    setResolving(id);
    const res = await fetch(`/api/admin/disputes/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, note: notes[id] || "" }),
    });
    if (res.ok) {
      toast.success(decision === "refund" ? "Customer refunded" : "Payment released to handyman");
      setDisputes(prev => prev.filter(d => d.id !== id));
    } else {
      const b = await res.json();
      toast.error(b.error || "Failed to resolve");
    }
    setResolving(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Disputes</h1>
        <p className="text-slate-400 mt-1">Review and resolve booking disputes</p>
      </div>

      {loading && <p className="text-slate-400">Loading...</p>}

      {!loading && disputes.length === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <p className="text-white font-bold text-lg">No open disputes</p>
          <p className="text-slate-400 text-sm mt-1">All disputes have been resolved.</p>
        </div>
      )}

      <div className="space-y-4">
        {disputes.map(d => (
          <div key={d.id} className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-white font-bold">{d.service.title}</p>
                  <span className="text-emerald-400 font-bold">{formatCurrency(d.totalPrice)}</span>
                </div>
                <p className="text-slate-400 text-sm mt-1">
                  Customer: <span className="text-white">{d.customer.name}</span> · Handyman: <span className="text-white">{d.handyman.name}</span>
                </p>
                <p className="text-slate-400 text-xs mt-1">Filed {formatDate(d.disputedAt)}</p>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Dispute Reason</p>
              <p className="text-white text-sm">{d.disputeReason}</p>
            </div>

            <div>
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1 block">Resolution Note (optional)</label>
              <input
                value={notes[d.id] || ""}
                onChange={e => setNotes(n => ({ ...n, [d.id]: e.target.value }))}
                placeholder="Internal note about this resolution..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-tarea-sky"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => resolve(d.id, "refund")}
                disabled={resolving === d.id || !d.isPaid}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 font-semibold text-sm hover:bg-red-500/20 transition-all disabled:opacity-40"
              >
                <XCircle className="w-4 h-4" />
                Refund Customer {!d.isPaid && "(not paid)"}
              </button>
              <button
                onClick={() => resolve(d.id, "release")}
                disabled={resolving === d.id}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 font-semibold text-sm hover:bg-emerald-500/20 transition-all disabled:opacity-40"
              >
                <CheckCircle className="w-4 h-4" />
                Release to Handyman
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Receipt, ExternalLink, Undo2, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Invoice = {
  id: string;
  number: string;
  service: string;
  handyman: string;
  date: string;
  total: number;
  materialsRefunded: number;
  url: string;
};

// Mirrors the app's Invoices & receipts screen.
//
// Receipts existed on the web only as a link inside one completion email, so a
// customer who deleted the mail had no way back to one. Same endpoint and same
// signed URLs as the app, so a receipt opens without a second login.
export default function InvoicesPage() {
  const [items, setItems] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((d) => setItems(d.invoices ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-black mb-1">Invoices &amp; receipts</h1>
      <p className="text-[var(--text-muted)] mb-6">Every job you&apos;ve paid for, newest first.</p>

      {loading ? (
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        // An empty list must say why — a blank panel reads as a broken page.
        <div className="rounded-2xl bg-white/5 border border-white/10 p-10 text-center">
          <Receipt className="w-10 h-10 mx-auto mb-3 text-[var(--text-subtle)]" />
          <p className="font-bold">No receipts yet</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Once you pay for a job, its receipt appears here and stays available.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((inv) => (
            <a
              key={inv.id}
              href={inv.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-2xl bg-white/5 border border-white/10 p-5 hover:border-tarea-sky transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-bold truncate">{inv.service}</p>
                  <p className="text-sm text-[var(--text-muted)] truncate">
                    {new Date(inv.date).toLocaleDateString(undefined, {
                      month: "short", day: "numeric", year: "numeric",
                    })}{" "}
                    · {inv.handyman}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-lg">{formatCurrency(inv.total)}</p>
                  <p className="text-xs text-[var(--text-subtle)]">#{inv.number}</p>
                </div>
              </div>

              {/* Only when something came back — otherwise it is a line of
                  zeroes on every receipt. */}
              {inv.materialsRefunded > 0 && (
                <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <Undo2 className="w-3.5 h-3.5" />
                  {formatCurrency(inv.materialsRefunded)} materials refunded
                </p>
              )}

              <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-tarea-sky">
                <ExternalLink className="w-3.5 h-3.5" /> View receipt
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { CreditCard, UserCheck, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// Mirrors the app's pre-request confirmation sheet.
//
// The card is saved when the request is sent but charged much later — only
// once the pro has accepted AND the customer has approved the final price.
// That is two separate moments where somebody could reasonably assume they had
// already paid, so both are stated before anything is submitted rather than
// after.
export default function ConfirmRequestSheet({
  proName,
  labour,
  onConfirm,
  onCancel,
  busy,
}: {
  proName: string;
  labour: number;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const serviceFee = labour * 0.15;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
         onClick={onCancel}>
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-6 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-black text-gray-900">Confirm your request</h3>
        <p className="mt-1 text-sm text-gray-500">
          You&apos;re asking {proName} to take this job. Nothing is charged yet.
        </p>

        {/* Materials are absent on purpose: the pro names them when they
            accept, and the customer approves the total after that. */}
        <div className="mt-5 rounded-2xl bg-gray-50 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Labour</span>
            <span className="font-semibold text-gray-900">{formatCurrency(labour)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Service fee (15%)</span>
            <span className="font-semibold text-gray-900">{formatCurrency(serviceFee)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
            <span className="font-black text-gray-900">So far</span>
            <span className="font-black text-gray-900 text-lg">{formatCurrency(labour + serviceFee)}</span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed pt-1">
            Materials aren&apos;t included yet — your pro adds them when they accept.
          </p>
        </div>

        {/* The promise, in the order it happens. */}
        <div className="mt-5 space-y-3">
          {[
            [CreditCard, "You add a card now. It's saved, not charged."],
            [UserCheck, "Your pro accepts and quotes any materials the job needs."],
            [CheckCircle2, "You approve the final price. Only then is your card charged — if they decline, or you don't approve, you pay nothing."],
          ].map(([Icon, text], i) => {
            const I = Icon as typeof CreditCard;
            return (
              <div key={i} className="flex items-start gap-3">
                <I className="w-4 h-4 mt-0.5 text-tarea-sky shrink-0" />
                <p className="text-xs text-gray-700 leading-relaxed">{text as string}</p>
              </div>
            );
          })}
        </div>

        <button
          onClick={onConfirm}
          disabled={busy}
          className="mt-6 w-full bg-tarea-sky text-tarea-ink font-bold py-4 rounded-2xl hover:bg-sky-300 transition-all disabled:opacity-50"
        >
          {busy ? "Sending…" : "Confirm & add card"}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="mt-1 w-full text-sm text-gray-500 hover:text-gray-700 py-2 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

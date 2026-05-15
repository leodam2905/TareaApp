"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { CreditCard, Plus, Trash2, Loader2, Star, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

const CARD_ELEMENT_OPTS = {
  style: {
    base: {
      color: "#f1f5f9",
      fontFamily: "inherit",
      fontSize: "14px",
      "::placeholder": { color: "#475569" },
      iconColor: "#38BDF8",
    },
    invalid: { color: "#f87171" },
  },
};

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  funding: string;
  isDefault: boolean;
}

const BRAND_ICONS: Record<string, string> = {
  visa: "💳", mastercard: "💳", amex: "💳", discover: "💳",
};

function AddCardForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    const cardEl = elements.getElement(CardElement);
    if (!cardEl) return;

    setLoading(true);

    // Create SetupIntent
    const res = await fetch("/api/customer/payment-methods", { method: "POST" });
    const { clientSecret, error: apiErr } = await res.json();
    if (apiErr || !clientSecret) {
      toast.error(apiErr ?? "Could not initialize card save");
      setLoading(false);
      return;
    }

    const { setupIntent, error } = await stripe.confirmCardSetup(clientSecret, {
      payment_method: { card: cardEl },
    });

    if (error) {
      toast.error(error.message ?? "Card error");
      setLoading(false);
      return;
    }

    if (setupIntent?.status === "succeeded") {
      toast.success("Card saved!");
      cardEl.clear();
      onSuccess();
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-4 p-4 bg-white/5 border border-white/10 rounded-xl">
      <p className="text-xs text-slate-400">Your card details are encrypted and stored securely by Stripe. We never see your card number.</p>
      <div className="p-3 bg-[#0F172A] border border-white/10 rounded-lg">
        <CardElement options={CARD_ELEMENT_OPTS} />
      </div>
      <button
        type="submit"
        disabled={loading || !stripe}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-tarea-sky hover:bg-sky-400 disabled:opacity-60 text-tarea-ink font-semibold rounded-xl transition-all text-sm"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {loading ? "Saving…" : "Save Card"}
      </button>
    </form>
  );
}

function Inner() {
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/customer/payment-methods")
      .then(r => r.json())
      .then(d => setMethods(d.methods ?? []));
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    if (!confirm("Remove this card?")) return;
    setRemoving(id);
    const res = await fetch(`/api/customer/payment-methods/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Card removed"); load(); }
    else toast.error("Failed to remove card");
    setRemoving(null);
  };

  const setDefault = async (id: string) => {
    setSettingDefault(id);
    const res = await fetch(`/api/customer/payment-methods/${id}`, { method: "PATCH" });
    if (res.ok) { toast.success("Default card updated"); load(); }
    else toast.error("Failed to set default");
    setSettingDefault(null);
  };

  if (!methods) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  const brandName = (brand: string) => brand.charAt(0).toUpperCase() + brand.slice(1);

  return (
    <div className="space-y-6">
      {/* Info */}
      <div className="flex items-start gap-3 px-5 py-4 bg-tarea-sky/10 border border-tarea-sky/20 rounded-2xl">
        <ShieldCheck className="w-5 h-5 text-tarea-sky flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-white font-semibold text-sm">Secure card storage</p>
          <p className="text-slate-400 text-xs mt-0.5">
            Saved cards let you check out faster. Your default card will be pre-selected when booking a handyman.
          </p>
        </div>
      </div>

      {/* Saved cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-tarea-sky" />
            <h2 className="text-white font-bold">Saved Cards</h2>
          </div>
          <button
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 text-xs text-tarea-sky hover:text-sky-300 border border-tarea-sky/30 hover:border-sky-400/50 px-3 py-1.5 rounded-lg transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add card
          </button>
        </div>

        {methods.length === 0 && !showAdd && (
          <div className="text-center py-10 border border-dashed border-white/10 rounded-xl">
            <CreditCard className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No saved cards yet</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 text-tarea-sky text-sm hover:text-sky-300 underline underline-offset-2"
            >
              Add your first card
            </button>
          </div>
        )}

        <div className="space-y-3">
          {methods.map(pm => (
            <div key={pm.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-tarea-sky/10 border border-tarea-sky/20 rounded-xl flex items-center justify-center text-lg">
                  {BRAND_ICONS[pm.brand] ?? "💳"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold text-sm">{brandName(pm.brand)} ···· {pm.last4}</p>
                    {pm.isDefault && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Default
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs">
                    Expires {pm.expMonth}/{pm.expYear}
                    {pm.funding === "debit" && <span className="ml-2 text-tarea-sky">Debit</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!pm.isDefault && (
                  <button
                    onClick={() => setDefault(pm.id)}
                    disabled={settingDefault === pm.id}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/20 px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50"
                  >
                    {settingDefault === pm.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
                    Set default
                  </button>
                )}
                <button
                  onClick={() => remove(pm.id)}
                  disabled={removing === pm.id}
                  className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                >
                  {removing === pm.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        {showAdd && (
          <AddCardForm onSuccess={() => { setShowAdd(false); load(); }} />
        )}
      </div>

      {/* Notice */}
      <div className="flex items-start gap-3 p-4 bg-white/5 border border-white/10 rounded-xl">
        <AlertCircle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
        <p className="text-slate-500 text-xs">
          Removing a card does not cancel any existing bookings. Charges for accepted bookings will still go through via Stripe Checkout.
        </p>
      </div>
    </div>
  );
}

export default function CustomerPaymentMethodsClient() {
  return (
    <Suspense>
      <Elements stripe={stripePromise}>
        <Inner />
      </Elements>
    </Suspense>
  );
}

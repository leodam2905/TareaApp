"use client";

import { useState, useEffect, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { CreditCard, Building2, Plus, Trash2, Loader2, Zap, CalendarClock, Star, AlertCircle, CheckCircle2 } from "lucide-react";
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

interface Card   { id: string; brand: string; last4: string; expMonth: number; expYear: number; funding: string; isDefault: boolean }
interface Bank   { id: string; bankName: string | null; last4: string; routingNumber: string | null; isDefault: boolean }
interface Methods { cards: Card[]; banks: Bank[] }

// ── Add debit card form ─────────────────────────────────────────────────────
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
    const { token, error } = await stripe.createToken(cardEl);

    if (error) {
      toast.error(error.message ?? "Card error");
      setLoading(false);
      return;
    }

    if (token.card?.funding !== "debit") {
      toast.error("Only debit cards are accepted for instant payouts.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/handyman/payout-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.id, type: "card" }),
    });
    const data = await res.json();

    if (res.ok) {
      toast.success("Debit card added!");
      cardEl.clear();
      onSuccess();
    } else {
      toast.error(data.error ?? "Failed to add card");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-4 p-4 bg-white/5 border border-white/10 rounded-xl">
      <p className="text-xs text-slate-400 mb-2">Enter your debit card details — we never store your card number.</p>
      <div className="p-3 bg-[#0F172A] border border-white/10 rounded-lg">
        <CardElement options={CARD_ELEMENT_OPTS} />
      </div>
      <button
        type="submit"
        disabled={loading || !stripe}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-500 hover:bg-violet-400 disabled:opacity-60 text-white font-semibold rounded-xl transition-all text-sm"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Add Debit Card
      </button>
    </form>
  );
}

// ── Add bank account form ───────────────────────────────────────────────────
function AddBankForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState({ holderName: "", routing: "", account: "", accountConfirm: "" });

  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe) return;

    if (fields.account !== fields.accountConfirm) {
      toast.error("Account numbers do not match");
      return;
    }

    setLoading(true);
    const { token, error } = await stripe.createToken("bank_account" as Parameters<typeof stripe.createToken>[0], {
      country: "US",
      currency: "usd",
      routing_number: fields.routing,
      account_number: fields.account,
      account_holder_name: fields.holderName,
      account_holder_type: "individual",
    } as Parameters<typeof stripe.createToken>[1]);

    if (error) {
      toast.error(error.message ?? "Bank error");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/handyman/payout-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token!.id, type: "bank_account" }),
    });
    const data = await res.json();

    if (res.ok) {
      toast.success("Bank account added!");
      setFields({ holderName: "", routing: "", account: "", accountConfirm: "" });
      onSuccess();
    } else {
      toast.error(data.error ?? "Failed to add bank account");
    }
    setLoading(false);
  };

  const inputCls = "w-full px-3 py-2.5 bg-[#0F172A] border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-tarea-sky/50";

  return (
    <form onSubmit={handleSubmit} className="space-y-3 mt-4 p-4 bg-white/5 border border-white/10 rounded-xl">
      <p className="text-xs text-slate-400 mb-2">US bank accounts only. Your details are sent directly to Stripe.</p>
      <input required placeholder="Account holder name" value={fields.holderName} onChange={set("holderName")} className={inputCls} />
      <input required placeholder="Routing number (9 digits)" value={fields.routing} onChange={set("routing")} maxLength={9} className={inputCls} />
      <input required placeholder="Account number" value={fields.account} onChange={set("account")} className={inputCls} />
      <input required placeholder="Confirm account number" value={fields.accountConfirm} onChange={set("accountConfirm")} className={inputCls} />
      <button
        type="submit"
        disabled={loading || !stripe}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-tarea-sky hover:bg-sky-400 disabled:opacity-60 text-tarea-ink font-semibold rounded-xl transition-all text-sm"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Add Bank Account
      </button>
    </form>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
function Inner() {
  const [methods, setMethods] = useState<Methods | null>(null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/handyman/payout-methods")
      .then(r => r.json())
      .then(setMethods);
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    if (!confirm("Remove this payout method?")) return;
    setRemoving(id);
    const res = await fetch(`/api/handyman/payout-methods/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Removed"); load(); }
    else toast.error("Failed to remove");
    setRemoving(null);
  };

  const setDefault = async (id: string) => {
    const res = await fetch(`/api/handyman/payout-methods/${id}`, { method: "PATCH" });
    if (res.ok) { toast.success("Set as default"); load(); }
    else toast.error("Failed");
  };

  if (!methods) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  const debitCards = methods.cards.filter(c => c.funding === "debit");
  const creditCards = methods.cards.filter(c => c.funding !== "debit");

  return (
    <div className="space-y-8">
      {/* Info banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-start gap-3 p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
          <Zap className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-white font-semibold text-sm">Debit Card — Instant Payouts</p>
            <p className="text-slate-400 text-xs mt-1">Cash out anytime and receive money within 30 minutes. A 1% fee applies (min $0.50).</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4 bg-tarea-sky/10 border border-tarea-sky/20 rounded-xl">
          <CalendarClock className="w-5 h-5 text-tarea-sky flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-white font-semibold text-sm">Bank Account — Weekly Payouts</p>
            <p className="text-slate-400 text-xs mt-1">Uncashed earnings are automatically sent to your bank every Monday, for free.</p>
          </div>
        </div>
      </div>

      {/* Debit cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-violet-400" />
            <h2 className="text-white font-bold">Debit Cards</h2>
            <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">Instant payouts</span>
          </div>
          <button
            onClick={() => { setShowAddCard(v => !v); setShowAddBank(false); }}
            className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 border border-violet-500/30 hover:border-violet-400/50 px-3 py-1.5 rounded-lg transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add card
          </button>
        </div>

        {creditCards.length > 0 && (
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-3 text-xs text-amber-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            Credit cards cannot be used for instant payouts. Add a debit card.
          </div>
        )}

        {debitCards.length === 0 && !showAddCard && (
          <div className="text-center py-8 border border-dashed border-white/10 rounded-xl">
            <CreditCard className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No debit card added yet</p>
            <button
              onClick={() => setShowAddCard(true)}
              className="mt-3 text-violet-400 text-sm hover:text-violet-300 underline underline-offset-2"
            >
              Add a debit card
            </button>
          </div>
        )}

        <div className="space-y-3">
          {debitCards.map(card => (
            <div key={card.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold text-sm">{card.brand} ···· {card.last4}</p>
                    {card.isDefault && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Default
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs">Expires {card.expMonth}/{card.expYear}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!card.isDefault && (
                  <button
                    onClick={() => setDefault(card.id)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/20 px-2.5 py-1.5 rounded-lg transition-all"
                  >
                    <Star className="w-3 h-3" /> Set default
                  </button>
                )}
                <button
                  onClick={() => remove(card.id)}
                  disabled={removing === card.id}
                  className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                >
                  {removing === card.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        {showAddCard && (
          <AddCardForm onSuccess={() => { setShowAddCard(false); load(); }} />
        )}
      </div>

      {/* Bank accounts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-tarea-sky" />
            <h2 className="text-white font-bold">Bank Accounts</h2>
            <span className="text-xs bg-tarea-sky/10 text-tarea-sky px-2 py-0.5 rounded-full border border-tarea-sky/20">Weekly payouts</span>
          </div>
          <button
            onClick={() => { setShowAddBank(v => !v); setShowAddCard(false); }}
            className="flex items-center gap-1.5 text-xs text-tarea-sky hover:text-sky-300 border border-tarea-sky/30 hover:border-sky-400/50 px-3 py-1.5 rounded-lg transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add account
          </button>
        </div>

        {methods.banks.length === 0 && !showAddBank && (
          <div className="text-center py-8 border border-dashed border-white/10 rounded-xl">
            <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No bank account added yet</p>
            <button
              onClick={() => setShowAddBank(true)}
              className="mt-3 text-tarea-sky text-sm hover:text-sky-300 underline underline-offset-2"
            >
              Add a bank account
            </button>
          </div>
        )}

        <div className="space-y-3">
          {methods.banks.map(bank => (
            <div key={bank.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-tarea-sky/10 border border-tarea-sky/20 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-tarea-sky" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold text-sm">{bank.bankName ?? "Bank"} ···· {bank.last4}</p>
                    {bank.isDefault && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Default
                      </span>
                    )}
                  </div>
                  {bank.routingNumber && (
                    <p className="text-slate-500 text-xs">Routing ···{bank.routingNumber.slice(-4)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!bank.isDefault && (
                  <button
                    onClick={() => setDefault(bank.id)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/20 px-2.5 py-1.5 rounded-lg transition-all"
                  >
                    <Star className="w-3 h-3" /> Set default
                  </button>
                )}
                <button
                  onClick={() => remove(bank.id)}
                  disabled={removing === bank.id}
                  className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                >
                  {removing === bank.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        {showAddBank && (
          <AddBankForm onSuccess={() => { setShowAddBank(false); load(); }} />
        )}
      </div>
    </div>
  );
}

export default function PayoutMethodsClient() {
  return (
    <Elements stripe={stripePromise}>
      <Inner />
    </Elements>
  );
}

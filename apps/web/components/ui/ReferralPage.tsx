"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Gift, Users, Tag, Loader2, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";

export default function ReferralPage() {
  const [code, setCode] = useState("");
  const [referredCount, setReferredCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [inputCode, setInputCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState("");
  const [alreadyReferred, setAlreadyReferred] = useState(false);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referrals/my-code")
      .then(r => r.json())
      .then(d => {
        setCode(d.code ?? "");
        setReferredCount(d.referredCount ?? 0);
        setLoading(false);
      });
  }, []);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Referral code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${code}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success("Link copied!");
  };

  const applyCode = async () => {
    if (!inputCode.trim()) return;
    setApplying(true);
    try {
      const res = await fetch("/api/referrals/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inputCode.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body.error === "Referral code already applied") setAlreadyReferred(true);
        throw new Error(body.error);
      }
      setAppliedPromo(body.promoCode);
      toast.success(body.message);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to apply code");
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 text-tarea-sky animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Refer & Earn</h1>
        <p className="text-slate-400 mt-1">Share Tarea with friends. Both of you get 10% off.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
          <Users className="w-6 h-6 text-tarea-sky mx-auto mb-2" />
          <p className="text-3xl font-extrabold text-white">{referredCount}</p>
          <p className="text-slate-400 text-sm mt-0.5">Friends referred</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
          <Gift className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
          <p className="text-3xl font-extrabold text-white">10%</p>
          <p className="text-slate-400 text-sm mt-0.5">Reward per referral</p>
        </div>
      </div>

      {/* Your code */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-bold flex items-center gap-2">
          <Tag className="w-4 h-4 text-tarea-sky" /> Your Referral Code
        </h2>
        <div className="flex items-center gap-3 p-4 bg-tarea-sky/10 border border-tarea-sky/20 rounded-xl">
          <span className="flex-1 text-2xl font-mono font-extrabold text-tarea-sky tracking-widest">{code}</span>
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-tarea-sky/20 hover:bg-tarea-sky/30 px-3 py-1.5 rounded-lg transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-medium">Or share your invite link:</p>
          <div className="flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl">
            <span className="flex-1 text-slate-400 text-xs truncate font-mono">{shareLink}</span>
            <button onClick={copyLink} className="text-tarea-sky text-xs font-semibold hover:underline flex-shrink-0">
              Copy link
            </button>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-bold">How it works</h2>
        <div className="space-y-3">
          {[
            { step: "1", text: "Share your code or link with a friend" },
            { step: "2", text: "They sign up and enter your referral code" },
            { step: "3", text: "You both get a 10% discount promo code" },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-center gap-4">
              <div className="w-8 h-8 bg-tarea-sky/20 border border-tarea-sky/30 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-tarea-sky text-sm font-bold">{step}</span>
              </div>
              <p className="text-slate-300 text-sm">{text}</p>
              {step !== "3" && <ChevronRight className="w-4 h-4 text-slate-600 ml-auto flex-shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Apply a referral code */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-bold">Got a Friend's Code?</h2>
        {appliedPromo ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1">
            <p className="text-emerald-300 font-semibold text-sm">Referral applied!</p>
            <p className="text-emerald-400/70 text-xs">Your 10% discount code:</p>
            <p className="text-white font-mono font-bold text-lg tracking-widest">{appliedPromo}</p>
            <p className="text-slate-400 text-xs">Use this at checkout on your next booking.</p>
          </div>
        ) : alreadyReferred ? (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <p className="text-amber-300 text-sm">You've already used a referral code.</p>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={inputCode}
              onChange={e => setInputCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && applyCode()}
              placeholder="Enter referral code"
              className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-tarea-sky font-mono tracking-widest"
            />
            <button
              onClick={applyCode}
              disabled={applying || !inputCode.trim()}
              className="px-4 py-2.5 rounded-xl bg-tarea-sky text-tarea-ink text-sm font-bold hover:bg-sky-300 transition-colors disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap"
            >
              {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Apply
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

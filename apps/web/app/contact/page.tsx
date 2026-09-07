"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, MessageSquare, Clock, CheckCircle2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import Logo from "@/components/ui/Logo";

const FAQS = [
  {
    q: "How do I cancel a booking?",
    a: "Go to your Bookings page, open the booking, and click Cancel. Cancellations made more than 24 hours in advance receive a full refund. Within 24 hours, a 50% refund is issued.",
  },
  {
    q: "How long does payment take to reach my account?",
    a: "Handymen receive payouts within 2–5 business days after a job is marked complete. Make sure you've connected a payout method in your Earnings page.",
  },
  {
    q: "My background check failed — what do I do?",
    a: "Contact our support team using the form below with your account email. We'll review your case and advise on next steps.",
  },
  {
    q: "How do I report a problem with a handyman or customer?",
    a: "Open the booking in question, scroll to the bottom, and use the Dispute button. Our team reviews disputes within 48 hours.",
  },
  {
    q: "Can I change my registered email address?",
    a: "Email changes require identity verification. Contact support and we'll walk you through the process.",
  },
  {
    q: "How do promo codes work?",
    a: "Enter your promo code in the booking form before submitting. Discounts are applied automatically based on the code type (percentage or fixed amount).",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-tarea-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-tarea-surface transition-colors"
      >
        <span className="text-tarea-ink font-medium text-sm">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-tarea-ink-muted flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-tarea-ink-muted flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4 text-tarea-ink-muted text-sm leading-relaxed border-t border-tarea-border pt-3">
          {a}
        </div>
      )}
    </div>
  );
}

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", role: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.message.trim()) { toast.error("Please describe your issue"); return; }
    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setSent(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const input = "w-full bg-tarea-paper border border-tarea-border rounded-xl px-4 py-3 text-tarea-ink text-sm placeholder:text-tarea-ink-subtle focus:outline-none focus:border-tarea-sky transition-colors";

  return (
    <div className="min-h-screen bg-tarea-cream text-tarea-ink-muted">
      {/* Nav */}
      <header className="border-b border-tarea-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={32} light />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-tarea-ink-muted hover:text-tarea-ink transition-colors">Sign in</Link>
            <Link href="/register" className="bg-tarea-sky text-tarea-ink font-semibold px-4 py-2 rounded-xl hover:bg-sky-300 transition-colors">Get started</Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-extrabold text-tarea-ink mb-4">How can we help?</h1>
          <p className="text-tarea-ink-muted text-lg max-w-xl mx-auto">
            Our support team is here Monday – Friday, 9 am – 6 pm ET. We typically reply within 1 business day.
          </p>
        </div>

        {/* Quick contact options */}
        <div className="grid md:grid-cols-3 gap-4 mb-16">
          {[
            { icon: Mail, title: "Email support", body: "support@taptarea.com", sub: "Replies within 1 business day", href: "mailto:support@taptarea.com" },
            { icon: MessageSquare, title: "Call us", body: "+1 (626) 628-1659", sub: "Monday – Friday, 9am–6pm ET", href: "tel:+16266281659" },
            { icon: Clock, title: "Response time", body: "< 24 hours", sub: "Monday – Friday" },
          ].map(({ icon: Icon, title, body, sub, href }) => (
            <div key={title} className="bg-tarea-paper border border-tarea-border rounded-2xl p-6 text-center">
              <div className="w-12 h-12 bg-tarea-sky/10 border border-tarea-sky/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Icon className="w-6 h-6 text-tarea-sky" />
              </div>
              <p className="text-tarea-ink font-semibold">{title}</p>
              {href ? (
                <a href={href} className="text-tarea-sky text-sm mt-1 block hover:underline">{body}</a>
              ) : (
                <p className="text-tarea-sky text-sm mt-1">{body}</p>
              )}
              <p className="text-tarea-ink-subtle text-xs mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-10">
          {/* Contact form */}
          <div className="lg:col-span-3">
            <h2 className="text-2xl font-bold text-tarea-ink mb-6">Send us a message</h2>
            {sent ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-tarea-ink">Message sent!</h3>
                <p className="text-tarea-ink-muted text-sm">
                  We've sent a confirmation to <strong className="text-tarea-ink">{form.email}</strong>. Expect a reply within 1 business day.
                </p>
                <button
                  onClick={() => { setSent(false); setForm({ name: "", email: "", role: "", subject: "", message: "" }); }}
                  className="text-tarea-sky text-sm hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-tarea-ink-muted text-xs font-medium block mb-1.5">Your name <span className="text-red-400">*</span></label>
                    <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="John Smith" required className={input} />
                  </div>
                  <div>
                    <label className="text-tarea-ink-muted text-xs font-medium block mb-1.5">Email address <span className="text-red-400">*</span></label>
                    <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@example.com" required className={input} />
                  </div>
                </div>

                <div>
                  <label className="text-tarea-ink-muted text-xs font-medium block mb-1.5">I am a…</label>
                  <select value={form.role} onChange={e => set("role", e.target.value)} className={input + " cursor-pointer"}>
                    <option value="" className="bg-tarea-cream">Select one</option>
                    <option value="Customer" className="bg-tarea-cream">Customer</option>
                    <option value="Handyman" className="bg-tarea-cream">Handyman</option>
                    <option value="Not registered" className="bg-tarea-cream">Not registered yet</option>
                  </select>
                </div>

                <div>
                  <label className="text-tarea-ink-muted text-xs font-medium block mb-1.5">Subject <span className="text-red-400">*</span></label>
                  <select value={form.subject} onChange={e => set("subject", e.target.value)} required className={input + " cursor-pointer"}>
                    <option value="" className="bg-tarea-cream">Choose a topic</option>
                    <option value="Booking issue" className="bg-tarea-cream">Booking issue</option>
                    <option value="Payment or refund" className="bg-tarea-cream">Payment or refund</option>
                    <option value="Account access" className="bg-tarea-cream">Account access</option>
                    <option value="Background check" className="bg-tarea-cream">Background check</option>
                    <option value="Report a user" className="bg-tarea-cream">Report a user</option>
                    <option value="Technical problem" className="bg-tarea-cream">Technical problem</option>
                    <option value="Other" className="bg-tarea-cream">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-tarea-ink-muted text-xs font-medium block mb-1.5">Message <span className="text-red-400">*</span></label>
                  <textarea
                    value={form.message}
                    onChange={e => set("message", e.target.value)}
                    placeholder="Describe your issue in as much detail as possible…"
                    rows={5}
                    required
                    className={input + " resize-none"}
                  />
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="w-full flex items-center justify-center gap-2 bg-tarea-sky text-tarea-ink font-bold py-3.5 rounded-xl hover:bg-sky-300 transition-all disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {sending ? "Sending…" : "Send Message"}
                </button>
              </form>
            )}
          </div>

          {/* FAQ */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-tarea-ink mb-6">Common questions</h2>
            <div className="space-y-2">
              {FAQS.map(item => <FaqItem key={item.q} {...item} />)}
            </div>
          </div>
        </div>

        {/* Footer links */}
        <div className="mt-16 pt-8 border-t border-tarea-border flex flex-wrap gap-6 text-sm text-tarea-ink-subtle">
          <Link href="/" className="hover:text-tarea-ink transition-colors">← Back to Tarea</Link>
          <Link href="/terms" className="hover:text-tarea-ink transition-colors">Terms of Service</Link>
          <Link href="/guarantee" className="hover:text-tarea-ink transition-colors">ZenTarea Guarantee</Link>
            <Link href="/privacy" className="hover:text-tarea-ink transition-colors">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
}

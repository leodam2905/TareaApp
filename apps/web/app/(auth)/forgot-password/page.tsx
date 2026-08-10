"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import Logo from "@/components/ui/Logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-tarea-surface flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-hero-gradient flex-col justify-between p-12">
        <Logo size={40} light />
        <div className="space-y-4">
          <h2 className="text-4xl font-extrabold text-white leading-tight">Locked out?</h2>
          <p className="text-blue-100 text-lg">No worries — we'll send you a secure reset link instantly.</p>
        </div>
        <p className="text-blue-300 text-sm">© 2026 <span className="logo-script">Tarea</span>. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Logo size={40} />
          </div>

          <div className="card">
            {sent ? (
              <div className="text-center space-y-4 py-4">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-tarea-ink">Check your email</h1>
                <p className="text-tarea-ink-muted text-sm leading-relaxed">
                  If <strong>{email}</strong> is registered, we sent a password reset link.
                  Check your inbox — it expires in 1 hour.
                </p>
                <p className="text-tarea-ink-subtle text-xs">
                  Didn't get it? Check your spam folder or{" "}
                  <button onClick={() => setSent(false)} className="text-tarea-dark hover:underline">
                    try again
                  </button>.
                </p>
                <Link href="/login" className="btn-primary w-full flex items-center justify-center mt-4">
                  Back to sign in
                </Link>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-tarea-sky/10 border border-tarea-sky/20 rounded-xl flex items-center justify-center">
                    <Mail className="w-6 h-6 text-tarea-sky" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-tarea-ink">Forgot password?</h1>
                    <p className="text-tarea-ink-muted text-sm">We'll send you a reset link</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="label">Email address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="input"
                      autoFocus
                      autoComplete="email"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loading ? "Sending…" : "Send Reset Link"}
                  </button>
                </form>

                <div className="mt-5 text-center">
                  <Link href="/login" className="text-tarea-ink-muted text-sm hover:text-tarea-ink transition-colors">
                    ← Back to sign in
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

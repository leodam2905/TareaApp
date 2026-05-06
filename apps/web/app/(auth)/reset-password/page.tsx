"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Wrench, Eye, EyeOff, Loader2, CheckCircle2, KeyRound } from "lucide-react";
import toast from "react-hot-toast";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (password !== confirm) { toast.error("Passwords don't match"); return; }
    if (!token) { toast.error("Invalid reset link"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="card text-center space-y-4">
        <p className="text-tarea-ink font-semibold">Invalid reset link.</p>
        <Link href="/forgot-password" className="btn-primary inline-block">Request a new link</Link>
      </div>
    );
  }

  return (
    <div className="card">
      {done ? (
        <div className="text-center space-y-4 py-4">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-tarea-ink">Password updated!</h1>
          <p className="text-tarea-ink-muted text-sm">Redirecting you to sign in…</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-tarea-sky/10 border border-tarea-sky/20 rounded-xl flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-tarea-sky" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-tarea-ink">New password</h1>
              <p className="text-tarea-ink-muted text-sm">Choose a strong password</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">New password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="input pr-12"
                  autoFocus
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-tarea-ink-subtle">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input
                type={showPw ? "text" : "password"}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat password"
                className="input"
              />
            </div>
            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Updating…" : "Set New Password"}
            </button>
          </form>

          <div className="mt-5 text-center">
            <Link href="/login" className="text-tarea-ink-muted text-sm hover:text-tarea-ink">
              ← Back to sign in
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-tarea-surface flex">
      <div className="hidden lg:flex lg:w-1/2 bg-hero-gradient flex-col justify-between p-12">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">Tarea</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-4xl font-extrabold text-white leading-tight">Almost there</h2>
          <p className="text-blue-100 text-lg">Set your new password and you're back in.</p>
        </div>
        <p className="text-blue-300 text-sm">© 2026 Tarea. All rights reserved.</p>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 bg-hero-gradient rounded-xl flex items-center justify-center">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-tarea-dark">Tarea</span>
          </div>
          <Suspense><ResetForm /></Suspense>
        </div>
      </div>
    </div>
  );
}

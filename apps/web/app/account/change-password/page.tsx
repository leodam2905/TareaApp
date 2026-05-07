"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, CheckCircle2, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));
  const toggleShow = (k: keyof typeof show) => setShow(s => ({ ...s, [k]: !s[k] }));

  const strength = (pw: string) => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  };

  const strengthLabel = ["", "Weak", "Weak", "Fair", "Good", "Strong"];
  const strengthColor = ["", "bg-red-500", "bg-red-400", "bg-amber-400", "bg-emerald-400", "bg-emerald-500"];
  const s = strength(form.newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (s < 2) {
      toast.error("Please choose a stronger password");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setDone(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-tarea-surface flex items-center justify-center p-6">
        <div className="w-full max-w-md card text-center space-y-5">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-tarea-ink">Password changed!</h1>
            <p className="text-tarea-ink-muted text-sm mt-1">Your password has been updated successfully.</p>
          </div>
          <button
            onClick={() => router.back()}
            className="btn-primary w-full"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const inputClass = "input pr-12";

  return (
    <div className="min-h-screen bg-tarea-surface flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <Link href="#" onClick={() => router.back()} className="flex items-center gap-2 text-tarea-ink-muted hover:text-tarea-ink text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="card space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-tarea-sky/10 rounded-xl flex items-center justify-center">
              <Lock className="w-5 h-5 text-tarea-sky" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-tarea-ink">Change Password</h1>
              <p className="text-tarea-ink-muted text-xs">Choose a strong, unique password</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current password */}
            <div>
              <label className="label">Current password</label>
              <div className="relative">
                <input
                  type={show.current ? "text" : "password"}
                  value={form.currentPassword}
                  onChange={e => set("currentPassword", e.target.value)}
                  placeholder="Your current password"
                  className={inputClass}
                  autoComplete="current-password"
                  required
                />
                <button type="button" onClick={() => toggleShow("current")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-tarea-ink-subtle hover:text-tarea-ink">
                  {show.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="label">New password</label>
              <div className="relative">
                <input
                  type={show.new ? "text" : "password"}
                  value={form.newPassword}
                  onChange={e => set("newPassword", e.target.value)}
                  placeholder="Min. 8 characters"
                  className={inputClass}
                  autoComplete="new-password"
                  required
                />
                <button type="button" onClick={() => toggleShow("new")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-tarea-ink-subtle hover:text-tarea-ink">
                  {show.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Strength meter */}
              {form.newPassword.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= s ? strengthColor[s] : "bg-gray-200"}`} />
                    ))}
                  </div>
                  <p className={`text-xs font-medium ${s <= 2 ? "text-red-500" : s === 3 ? "text-amber-500" : "text-emerald-500"}`}>
                    {strengthLabel[s]}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="label">Confirm new password</label>
              <div className="relative">
                <input
                  type={show.confirm ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={e => set("confirmPassword", e.target.value)}
                  placeholder="Repeat new password"
                  className={inputClass}
                  autoComplete="new-password"
                  required
                />
                <button type="button" onClick={() => toggleShow("confirm")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-tarea-ink-subtle hover:text-tarea-ink">
                  {show.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.confirmPassword && form.newPassword !== form.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">Passwords don&apos;t match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Updating…" : "Update Password"}
            </button>
          </form>

          <p className="text-center text-xs text-tarea-ink-muted">
            Forgot your current password?{" "}
            <Link href="/forgot-password" className="text-tarea-dark font-semibold hover:underline">
              Reset it
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

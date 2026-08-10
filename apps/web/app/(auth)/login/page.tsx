"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Eye, EyeOff, Loader2, ShieldCheck, Phone, RotateCcw } from "lucide-react";
import Logo from "@/components/ui/Logo";

// ─── Step 1: credentials ───────────────────────────────────────────────────
const credSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type CredData = z.infer<typeof credSchema>;

// ─── Step 2: OTP ───────────────────────────────────────────────────────────
const OTP_LENGTH = 6;

export default function LoginPage() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // OTP state
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [phoneMask, setPhoneMask] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  // Phone collection step (for users who registered without one)
  const [requiresPhone, setRequiresPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CredData>({ resolver: zodResolver(credSchema) });

  // ── Submit credentials ──────────────────────────────────────────────────
  const onCredentials = async (data: CredData) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Login failed");

      if (body.requiresOtp) {
        setPendingToken(body.pendingToken);
        setPhoneMask(body.phoneMask ?? "");
        if (body.requiresPhone) setRequiresPhone(true);
        toast.success("Verification code sent to your email" + (body.phoneMask ? " and phone" : ""));
        return;
      }

      toast.success("Welcome back!");
      const dest = body.role === "ADMIN" ? "/admin/dashboard" : body.role === "HANDYMAN" ? "/handyman/dashboard" : "/customer/dashboard";
      router.push(dest);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // ── OTP digit input ─────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKey = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!text) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill("");
    text.split("").forEach((d, i) => { next[i] = d; });
    setOtp(next);
    inputRefs.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus();
  };

  // ── Verify OTP ──────────────────────────────────────────────────────────
  const verifyOtp = async () => {
    const code = otp.join("");
    if (code.length < OTP_LENGTH) { toast.error("Enter the full 6-digit code"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken, code }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Verification failed");
      toast.success("Welcome back!");
      const dest = body.role === "ADMIN" ? "/admin/dashboard" : body.role === "HANDYMAN" ? "/handyman/dashboard" : "/customer/dashboard";
      router.push(dest);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
      setOtp(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ──────────────────────────────────────────────────────────
  const resendOtp = async () => {
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setPendingToken(body.pendingToken);
      setOtp(Array(OTP_LENGTH).fill(""));
      toast.success("New code sent!");
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not resend");
    } finally {
      setResending(false);
    }
  };

  // ── Submit phone (for users without one) ────────────────────────────────
  const submitPhone = async () => {
    if (!phoneInput.trim()) { toast.error("Enter your phone number"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/add-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken, phone: phoneInput.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed");
      setRequiresPhone(false);
      setPendingToken(body.pendingToken);
      setPhoneMask(body.phoneMask ?? "");
      toast.success("Code sent!");
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────
  const leftPanel = (
    <div className="hidden lg:flex lg:w-1/2 bg-hero-gradient flex-col justify-between p-12">
      <Logo size={96} light />
      <div className="space-y-6">
        <h2 className="text-4xl font-extrabold text-white leading-tight">Your trusted handyman platform</h2>
        <p className="text-blue-100 text-lg leading-relaxed">
          Verified professionals ready to help with any home repair or maintenance task.
        </p>
        <div className="space-y-4">
          {["Available in all 50 states", "Background-checked professionals", "Secure, insured payments"].map((item) => (
            <div key={item} className="flex items-center gap-3">
              <div className="w-5 h-5 bg-tarea-sky rounded-full flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </div>
              <span className="text-blue-100">{item}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-blue-300 text-sm">© 2026 <span className="logo-script">Tarea</span>. All rights reserved.</p>
    </div>
  );

  // ── Add-phone screen ────────────────────────────────────────────────────
  if (requiresPhone) {
    return (
      <div className="min-h-screen bg-tarea-surface flex">
        {leftPanel}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="card space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-tarea-sky/10 border border-tarea-sky/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-8 h-8 text-tarea-sky" />
                </div>
                <h1 className="text-2xl font-bold text-tarea-ink">Add your phone number</h1>
                <p className="text-tarea-ink-muted mt-2 text-sm">
                  We need your phone to send a verification code each time you sign in.
                </p>
              </div>

              <div>
                <label className="label">Phone number</label>
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submitPhone()}
                  placeholder="+1 (555) 000-0000"
                  className="input"
                  autoFocus
                  autoComplete="tel"
                />
              </div>

              <button
                onClick={submitPhone}
                disabled={loading || !phoneInput.trim()}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Sending code…" : "Send Verification Code"}
              </button>

              <button
                onClick={() => { setRequiresPhone(false); setPendingToken(null); }}
                className="w-full text-center text-tarea-ink-muted text-sm hover:text-tarea-ink transition-colors"
              >
                ← Back to sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── OTP screen ──────────────────────────────────────────────────────────
  if (pendingToken) {
    return (
      <div className="min-h-screen bg-tarea-surface flex">
        {leftPanel}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="card space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-tarea-sky/10 border border-tarea-sky/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-8 h-8 text-tarea-sky" />
                </div>
                <h1 className="text-2xl font-bold text-tarea-ink">Verify your phone</h1>
                <p className="text-tarea-ink-muted mt-2 text-sm">
                  We sent a 6-digit code to <span className="font-semibold text-tarea-ink">{phoneMask || "your phone"}</span>
                </p>
              </div>

              {/* OTP input boxes */}
              <div className="flex gap-3 justify-center" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKey(i, e)}
                    className="w-12 h-14 text-center text-xl font-bold rounded-xl border-2 border-tarea-border bg-tarea-surface text-tarea-ink focus:border-tarea-sky focus:outline-none transition-colors"
                  />
                ))}
              </div>

              <button
                onClick={verifyOtp}
                disabled={loading || otp.join("").length < OTP_LENGTH}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Verifying…" : "Verify Code"}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  onClick={() => { setPendingToken(null); setOtp(Array(OTP_LENGTH).fill("")); }}
                  className="text-tarea-ink-muted hover:text-tarea-ink transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={resendOtp}
                  disabled={resending}
                  className="flex items-center gap-1.5 text-tarea-dark font-semibold hover:underline disabled:opacity-50"
                >
                  {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  Resend code
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Credentials screen ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-tarea-surface flex">
      {leftPanel}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Logo size={36} />
          </div>

          <div className="card">
            <h1 className="text-2xl font-bold text-tarea-ink mb-1">Welcome back</h1>
            <p className="text-tarea-ink-muted mb-8">Sign in to your Tarea account</p>

            <form onSubmit={handleSubmit(onCredentials)} className="space-y-5">
              <div>
                <label className="label">Email address</label>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="you@example.com"
                  className="input"
                  autoComplete="email"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    {...register("password")}
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    className="input pr-12"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-tarea-ink-subtle hover:text-tarea-ink"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-tarea-ink-muted text-xs hover:text-tarea-dark transition-colors">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Checking…" : "Continue"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-tarea-ink-muted text-sm">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="text-tarea-dark font-semibold hover:underline">
                  Create one free
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Eye, EyeOff, Loader2, User, Hammer, MapPin, LocateFixed, Building2, UserCircle2 } from "lucide-react";
import Logo from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

const US_STATES = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
  ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["FL","Florida"],["GA","Georgia"],
  ["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],
  ["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],
  ["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],
  ["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],
  ["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],
  ["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],
  ["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],
  ["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],["DC","Washington D.C."],
] as const;

const STATE_NAME_TO_CODE: Record<string, string> = Object.fromEntries(US_STATES.map(([code, name]) => [name, code]));

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(7, "Phone number is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  role: z.enum(["CUSTOMER", "HANDYMAN"]),
  accountType: z.enum(["INDIVIDUAL", "COMPANY"]),
  companyName: z.string().optional(),
  ein: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  referralCode: z.string().optional(),
  agreedToTerms: z.boolean().refine((v) => v === true, {
    message: "You must accept the Terms and Privacy Policy",
  }),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((d) => d.accountType !== "COMPANY" || (d.companyName && d.companyName.length >= 2), {
  message: "Company name is required",
  path: ["companyName"],
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const defaultRole = params.get("role") === "HANDYMAN" ? "HANDYMAN" : "CUSTOMER";

  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [comingSoonState, setComingSoonState] = useState<string | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: defaultRole, accountType: "INDIVIDUAL", agreedToTerms: false },
  });

  const role = watch("role");
  const accountType = watch("accountType");

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setValue("latitude", latitude);
        setValue("longitude", longitude);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          const a = data.address || {};
          const road = [a.house_number, a.road].filter(Boolean).join(" ");
          if (road) setValue("address", road);
          if (a.city || a.town || a.village) setValue("city", a.city || a.town || a.village);
          if (a.state) {
            const abbr = STATE_NAME_TO_CODE[a.state] ?? a.state;
            setValue("state", abbr);
          }
          if (a.postcode) setValue("zipCode", a.postcode);
          toast.success("Location detected!");
        } catch {
          toast.error("Could not reverse-geocode your location");
        }
        setLocating(false);
      },
      () => {
        toast.error("Location access denied");
        setLocating(false);
      }
    );
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setComingSoonState(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body.code === "STATE_INACTIVE") {
          setComingSoonState(data.state || "your state");
          return;
        }
        throw new Error(body.error || "Registration failed");
      }
      setPendingToken(body.pendingToken);
      setPendingRole(body.role);
      toast.success("Code sent to your phone and email!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async () => {
    if (otpCode.length !== 6) return;
    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken, code: otpCode }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Invalid code");
      toast.success("Phone verified! Welcome to Tarea.");
      router.push(pendingRole === "HANDYMAN" ? "/handyman/onboarding" : "/customer/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setOtpLoading(false);
    }
  };

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
      toast.success("New code sent!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to resend");
    } finally {
      setResending(false);
    }
  };

  if (pendingToken) {
    return (
      <div className="min-h-screen bg-tarea-surface flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-tarea-sky/10 border border-tarea-sky/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📱</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white mb-2">Verify your account</h1>
            <p className="text-slate-400 text-sm">We sent a 6-digit code to your phone and email. Enter it below to complete registration.</p>
          </div>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otpCode}
            onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="w-full text-center text-3xl font-bold tracking-[0.5em] bg-white/5 border border-white/10 rounded-2xl px-4 py-5 text-white placeholder-slate-600 focus:outline-none focus:border-tarea-sky mb-4"
          />
          <button
            onClick={submitOtp}
            disabled={otpCode.length !== 6 || otpLoading}
            className="w-full py-3.5 bg-tarea-sky text-tarea-ink font-bold rounded-xl text-sm hover:bg-sky-300 transition-all disabled:opacity-50 mb-3"
          >
            {otpLoading ? "Verifying…" : "Verify & Continue"}
          </button>
          <button
            onClick={resendOtp}
            disabled={resending}
            className="w-full py-2.5 text-slate-400 text-sm hover:text-white transition-colors"
          >
            {resending ? "Sending…" : "Didn't receive it? Resend to phone & email"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tarea-surface flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-hero-gradient flex-col justify-between p-12">
        <Logo size={36} light />
        <div className="space-y-6">
          <h2 className="text-4xl font-extrabold text-white leading-tight">
            {role === "HANDYMAN"
              ? "Turn your skills into income"
              : "Quality home services at your fingertips"}
          </h2>
          <p className="text-blue-100 text-lg leading-relaxed">
            {role === "HANDYMAN"
              ? "Join 2,000+ handymen earning great income on their own schedule."
              : "Book trusted professionals for any home repair in minutes."}
          </p>
          <div className="space-y-4">
            {(role === "HANDYMAN"
              ? ["Set your own schedule", "Earn $50–$150/hr", "Free to join", "Get paid instantly"]
              : ["Verified professionals", "Upfront pricing", "On-time guarantee", "Easy booking"]
            ).map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 bg-tarea-sky rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
                <span className="text-blue-100">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-blue-300 text-sm">© 2026 Tarea. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Logo size={36} />
          </div>

          <div className="card">
            <h1 className="text-2xl font-bold text-tarea-ink mb-1">Create your account</h1>
            <p className="text-tarea-ink-muted mb-6">Join Tarea for free today</p>

            {/* Role selector */}
            <div className="grid grid-cols-2 gap-3 mb-4 p-1 bg-tarea-surface rounded-xl">
              {[
                { value: "CUSTOMER", label: "I need a Handyman", icon: User },
                { value: "HANDYMAN", label: "I'm a Handyman", icon: Hammer },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setValue("role", value as "CUSTOMER" | "HANDYMAN")}
                  className={cn(
                    "flex items-center gap-2 justify-center py-3 px-2 rounded-lg text-sm font-semibold transition-all duration-200",
                    role === value
                      ? "bg-white text-tarea-dark shadow-card border border-tarea-border"
                      : "text-tarea-ink-muted hover:text-tarea-ink"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Account type selector */}
            <div className="grid grid-cols-2 gap-3 mb-6 p-1 bg-tarea-surface rounded-xl">
              {[
                { value: "INDIVIDUAL", label: "Individual", icon: UserCircle2 },
                { value: "COMPANY", label: "Company", icon: Building2 },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setValue("accountType", value as "INDIVIDUAL" | "COMPANY")}
                  className={cn(
                    "flex items-center gap-2 justify-center py-3 px-2 rounded-lg text-sm font-semibold transition-all duration-200",
                    accountType === value
                      ? "bg-white text-tarea-dark shadow-card border border-tarea-border"
                      : "text-tarea-ink-muted hover:text-tarea-ink"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Basic info */}
              <div>
                <label className="label">Full name</label>
                <input {...register("name")} placeholder="John Smith" className="input" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="label">Email address</label>
                <input {...register("email")} type="email" placeholder="you@example.com" className="input" />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className="label">Phone number <span className="text-red-400">*</span></label>
                <input {...register("phone")} type="tel" placeholder="+1 (555) 000-0000" className="input" autoComplete="tel" />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
              </div>

              {/* Company fields */}
              {accountType === "COMPANY" && (
                <div className="border border-tarea-border rounded-xl p-4 space-y-3 bg-tarea-surface">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-4 h-4 text-tarea-sky" />
                    <span className="text-sm font-semibold text-tarea-ink">Company Information</span>
                  </div>
                  <div>
                    <label className="label">Company name <span className="text-red-400">*</span></label>
                    <input {...register("companyName")} placeholder="Acme Services LLC" className="input" />
                    {errors.companyName && <p className="text-red-500 text-xs mt-1">{errors.companyName.message}</p>}
                  </div>
                  <div>
                    <label className="label">EIN / Tax ID <span className="text-tarea-ink-subtle text-xs">(optional)</span></label>
                    <input {...register("ein")} placeholder="12-3456789" className="input" />
                  </div>
                  <div>
                    <label className="label">Website <span className="text-tarea-ink-subtle text-xs">(optional)</span></label>
                    <input {...register("website")} type="url" placeholder="https://yourcompany.com" className="input" />
                  </div>
                </div>
              )}

              {/* Location */}
              <div className="border-t border-tarea-border pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-tarea-sky" />
                    <span className="text-sm font-semibold text-tarea-ink">Your Location</span>
                  </div>
                  <button
                    type="button"
                    onClick={detectLocation}
                    disabled={locating}
                    className="flex items-center gap-1.5 text-xs font-semibold text-tarea-sky hover:text-sky-600 transition-colors disabled:opacity-50"
                  >
                    {locating
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <LocateFixed className="w-3.5 h-3.5" />}
                    {locating ? "Detecting…" : "Detect my location"}
                  </button>
                </div>

                <div>
                  <label className="label">Street address (optional)</label>
                  <input {...register("address")} placeholder="123 Main St" className="input" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">City <span className="text-red-400">*</span></label>
                    <input {...register("city")} placeholder="Miami" className="input" />
                    {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
                  </div>
                  <div>
                    <label className="label">State <span className="text-red-400">*</span></label>
                    <select {...register("state")} className="input">
                      <option value="">Select state</option>
                      {US_STATES.map(([code, name]) => (
                        <option key={code} value={code}>{name}</option>
                      ))}
                    </select>
                    {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state.message}</p>}
                  </div>
                </div>

                <div>
                  <label className="label">ZIP code (optional)</label>
                  <input {...register("zipCode")} placeholder="33101" className="input" />
                </div>
              </div>

              {/* Password */}
              <div className="border-t border-tarea-border pt-4">
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    {...register("password")}
                    type={showPw ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    className="input pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-tarea-ink-subtle"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>
              <div>
                <label className="label">Confirm password</label>
                <input
                  {...register("confirmPassword")}
                  type={showPw ? "text" : "password"}
                  placeholder="Repeat password"
                  className="input"
                />
                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
              </div>

              <div>
                <label className="label">Referral Code <span className="text-tarea-ink-muted font-normal">(optional)</span></label>
                <input {...register("referralCode")} placeholder="e.g. JOHN1A2B"
                  className="input uppercase" autoComplete="off" />
              </div>

              <div className="flex items-start gap-3 pt-1">
                <input
                  {...register("agreedToTerms")}
                  type="checkbox"
                  id="agreedToTerms"
                  className="mt-0.5 w-4 h-4 rounded border-tarea-border text-tarea-sky accent-tarea-sky cursor-pointer"
                />
                <label htmlFor="agreedToTerms" className="text-tarea-ink-muted text-xs leading-relaxed cursor-pointer">
                  I agree to the{" "}
                  <Link href="/terms" className="text-tarea-dark hover:underline font-medium">Terms of Service</Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-tarea-dark hover:underline font-medium">Privacy Policy</Link>
                </label>
              </div>
              {errors.agreedToTerms && (
                <p className="text-red-500 text-xs -mt-1">{errors.agreedToTerms.message}</p>
              )}

              <p className="text-tarea-ink-muted text-xs leading-relaxed">
                By providing your phone number and creating an account, you agree to receive recurring SMS text messages from Tarea, including one-time verification codes and booking notifications. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. See our{" "}
                <Link href="/privacy" className="text-tarea-dark hover:underline font-medium">Privacy Policy</Link>{" "}for details on how we handle your mobile information.
              </p>

              {comingSoonState && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center space-y-1">
                  <p className="text-amber-800 font-semibold text-sm">🚀 Coming soon to {comingSoonState}!</p>
                  <p className="text-amber-700 text-xs">We&apos;re not in your state yet but expanding fast. Follow us for updates.</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>

            <div className="mt-5 text-center">
              <p className="text-tarea-ink-muted text-sm">
                Already have an account?{" "}
                <Link href="/login" className="text-tarea-dark font-semibold hover:underline">Sign in</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

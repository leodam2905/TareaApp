"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Wrench, Eye, EyeOff, Loader2, User, Hammer, MapPin, LocateFixed } from "lucide-react";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(7, "Phone number is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  role: z.enum(["CUSTOMER", "HANDYMAN"]),
  address: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  agreedToTerms: z.boolean().refine((v) => v === true, {
    message: "You must accept the Terms and Privacy Policy",
  }),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
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

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: defaultRole, agreedToTerms: false },
  });

  const role = watch("role");

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
          if (a.state) setValue("state", a.state);
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
      toast.success("Account created! Welcome to Tarea.");
      router.push(data.role === "HANDYMAN" ? "/handyman/onboarding" : "/customer/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-tarea-surface flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-hero-gradient flex-col justify-between p-12">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">Tarea</span>
        </div>
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
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 bg-hero-gradient rounded-xl flex items-center justify-center">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-tarea-dark">Tarea</span>
          </div>

          <div className="card">
            <h1 className="text-2xl font-bold text-tarea-ink mb-1">Create your account</h1>
            <p className="text-tarea-ink-muted mb-6">Join Tarea for free today</p>

            {/* Role selector */}
            <div className="grid grid-cols-2 gap-3 mb-6 p-1 bg-tarea-surface rounded-xl">
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
                    <input {...register("state")} placeholder="FL" className="input" />
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

"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";

export default function PaySuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(n => {
        if (n <= 1) { clearInterval(id); router.push("/customer/bookings"); return 0; }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="max-w-md mx-auto flex flex-col items-center justify-center py-24 space-y-6 text-center">
      <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-white">Payment Confirmed!</h1>
        <p className="text-slate-400">
          Your booking is now confirmed and paid. Your handyman has been notified.
        </p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 w-full space-y-2">
        <p className="text-slate-400 text-sm">What happens next?</p>
        <ul className="text-left space-y-2 text-sm text-slate-300">
          <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Receipt sent to your email</li>
          <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Handyman will contact you before arrival</li>
          <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Track progress in your bookings</li>
        </ul>
      </div>

      <Link href="/customer/bookings"
        className="flex items-center gap-2 bg-tarea-sky text-tarea-ink font-bold px-6 py-3 rounded-xl hover:bg-sky-300 transition-all">
        View My Bookings <ArrowRight className="w-4 h-4" />
      </Link>

      <p className="text-slate-600 text-sm flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Redirecting in {countdown}s…
      </p>
    </div>
  );
}

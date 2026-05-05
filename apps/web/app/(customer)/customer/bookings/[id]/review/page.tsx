"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { useT } from "@/contexts/LanguageContext";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useT();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!rating) { toast.error("Please select a rating"); return; }
    setSaving(true);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: id, rating, comment: comment.trim() || undefined }),
    });
    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push("/customer/bookings"), 2000);
    } else {
      const b = await res.json();
      toast.error(b.error || "Failed to submit review");
    }
    setSaving(false);
  };

  if (done) {
    return (
      <div className="max-w-md mx-auto flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-white text-xl font-bold">Review submitted!</h2>
        <p className="text-slate-400 text-sm">Redirecting to your bookings…</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">{t("page_review")}</h1>
        <p className="text-slate-400 mt-1">{t("page_review_sub")}</p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
        {/* Star rating */}
        <div>
          <label className="text-slate-300 text-sm font-medium block mb-3">Your Rating</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
              >
                <Star
                  className={`w-9 h-9 transition-all ${
                    n <= (hover || rating)
                      ? "text-amber-400 fill-amber-400 scale-110"
                      : "text-slate-600"
                  }`}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-amber-400 text-sm mt-2 font-medium">
              {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}
            </p>
          )}
        </div>

        {/* Comment */}
        <div>
          <label className="text-slate-300 text-sm font-medium block mb-1.5">Comment (optional)</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Describe your experience…"
            rows={4}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-tarea-sky resize-none"
          />
        </div>

        <button onClick={submit} disabled={saving || !rating}
          className="w-full flex items-center justify-center gap-2 bg-tarea-sky text-tarea-ink font-bold py-3.5 rounded-xl hover:bg-sky-300 transition-all disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? t("btn_submitting") : t("btn_submit_review")}
        </button>
      </div>
    </div>
  );
}

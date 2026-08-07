"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Upload, Loader2, AlertTriangle, Clock,
  CheckCircle2, ArrowRight, X, ImagePlus, Lightbulb,
} from "lucide-react";
import { SERVICE_CATEGORY_LABELS } from "@/lib/utils";
import CategoryIcon from "@/components/ui/CategoryIcon";

type Diagnosis = {
  category: string;
  confidence: "high" | "medium" | "low";
  explanation: string;
  urgency: "urgent" | "soon" | "routine";
  tips: string[];
};

const urgencyConfig = {
  urgent:  { label: "Fix Today",            icon: AlertTriangle, color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/25",    dot: "bg-red-400"     },
  soon:    { label: "Fix Within a Week",     icon: Clock,         color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/25",  dot: "bg-amber-400"   },
  routine: { label: "No Rush — Plan Ahead", icon: CheckCircle2,  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25",dot: "bg-emerald-400" },
};

const categoryAccent: Record<string, string> = {
  PLUMBING:        "#38BDF8",
  ELECTRICAL:      "#F59E0B",
  CARPENTRY:       "#D97706",
  PAINTING:        "#A78BFA",
  CLEANING:        "#34D399",
  HVAC:            "#7DD3FC",
  ROOFING:         "#94A3B8",
  LANDSCAPING:     "#4ADE80",
  MOVING:          "#FB923C",
  APPLIANCE_REPAIR:"#818CF8",
  GENERAL:         "#94A3B8",
};

export default function DiagnosePage() {
  const [preview,     setPreview]     = useState<string | null>(null);
  const [imageBase64, setBase64]      = useState<string | null>(null);
  const [mediaType,   setMediaType]   = useState("image/jpeg");
  const [description, setDescription] = useState("");
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState<Diagnosis | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [dragging,    setDragging]    = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setMediaType(file.type as string);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      setBase64(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
    setResult(null);
    setError(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const analyze = async () => {
    if (!imageBase64 && !description.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ai/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mediaType, description }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Analysis failed");
      else setResult(data);
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  const reset = () => {
    setPreview(null); setBase64(null); setDescription("");
    setResult(null); setError(null);
  };

  const urgency = result ? urgencyConfig[result.urgency] : null;
  const accent  = result ? (categoryAccent[result.category] ?? "#38BDF8") : "#38BDF8";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white">Diagnose Your Issue</h1>
        <p className="text-slate-400 mt-2 leading-relaxed">
          Upload a photo or describe the problem and we'll tell you exactly which pro you need — and how urgent it is.
        </p>
      </div>

      {/* Input card */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">

        {/* Image upload */}
        <div>
          <p className="text-slate-300 text-sm font-semibold mb-3">
            Photo of the issue{" "}
            <span className="text-slate-500 font-normal">(optional but recommended)</span>
          </p>

          <AnimatePresence mode="wait">
            {preview ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="relative rounded-xl overflow-hidden border border-white/10 group"
              >
                <img src={preview} alt="Issue" className="w-full max-h-64 object-cover" />
                {/* Scan corners */}
                <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-tarea-sky rounded-tl-sm" />
                <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-tarea-sky rounded-tr-sm" />
                <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-tarea-sky rounded-bl-sm" />
                <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-tarea-sky rounded-br-sm" />
                <button
                  onClick={reset}
                  className="absolute top-2.5 right-2.5 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3">
                  <button onClick={reset} className="text-xs text-white/70 hover:text-white transition-colors font-medium">
                    Click to change photo
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="dropzone"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all duration-200
                  ${dragging ? "border-tarea-sky bg-tarea-sky/5 scale-[1.01]" : "border-white/15 hover:border-white/30 hover:bg-white/[0.03]"}`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${dragging ? "bg-tarea-sky/15" : "bg-white/5"}`}>
                  <ImagePlus className={`w-7 h-7 ${dragging ? "text-tarea-sky" : "text-slate-500"}`} />
                </div>
                <div className="text-center">
                  <p className="text-slate-300 font-semibold text-sm">Drop a photo here or click to upload</p>
                  <p className="text-slate-500 text-xs mt-1">JPG, PNG or WebP · Max 5 MB</p>
                </div>
                <div className="flex items-center gap-2 text-tarea-sky text-sm font-semibold">
                  <Upload className="w-4 h-4" /> Choose Photo
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
        </div>

        {/* OR divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/8" />
          <span className="text-slate-600 text-xs font-medium">or describe it</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        {/* Description */}
        <div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. There's a wet patch on the ceiling that appeared after heavy rain, and I can see slight discoloration spreading…"
            rows={3}
            className="input resize-none text-sm"
          />
        </div>

        {/* Analyze CTA */}
        <button
          onClick={analyze}
          disabled={loading || (!imageBase64 && !description.trim())}
          className="w-full flex items-center justify-center gap-2.5 font-bold py-3.5 rounded-xl transition-all duration-200 disabled:opacity-35 disabled:cursor-not-allowed bg-tarea-sky hover:bg-sky-300 text-tarea-ink"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Inspecting your issue…</span></>
            : <><span className="text-lg">🔍</span><span>Diagnose My Issue</span></>
          }
        </button>
      </div>

      {/* Loading animation */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 py-3"
          >
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.35, 1, 0.35] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  className="w-2 h-2 bg-tarea-sky rounded-full"
                />
              ))}
            </div>
            <p className="text-slate-500 text-sm">Assessing the situation…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 bg-red-500/10 border border-red-500/25 rounded-xl p-4"
          >
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {result && urgency && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="space-y-3"
          >
            {/* Result card */}
            <div className="rounded-2xl overflow-hidden border border-white/8">

              {/* Category header band */}
              <div
                className="flex items-center gap-4 px-6 py-5"
                style={{ background: `linear-gradient(135deg, ${accent}18 0%, ${accent}08 100%)`, borderBottom: `1px solid ${accent}20` }}
              >
                <motion.div
                  initial={{ scale: 0, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, delay: 0.05 }}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}
                >
                  <CategoryIcon catKey={result.category} active className="w-7 h-7" />
                </motion.div>
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-0.5">You need a</p>
                  <p className="text-white text-2xl font-extrabold" style={{ color: accent }}>
                    {SERVICE_CATEGORY_LABELS[result.category] || result.category} Pro
                  </p>
                </div>
              </div>

              <div className="bg-white/5 p-6 space-y-5">

                {/* Urgency */}
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${urgency.bg} ${urgency.border}`}
                  style={{ borderLeftWidth: 3, borderLeftColor: urgency.dot.replace("bg-", "") }}
                >
                  <urgency.icon className={`w-4.5 h-4.5 ${urgency.color} flex-shrink-0`} />
                  <div>
                    <p className={`text-sm font-bold ${urgency.color}`}>{urgency.label}</p>
                  </div>
                </div>

                {/* Assessment */}
                <div className="space-y-2">
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Assessment</p>
                  <p className="text-slate-300 text-sm leading-relaxed">{result.explanation}</p>
                </div>

                <div className="h-px bg-white/8" />

                {/* Tips */}
                <div className="space-y-2">
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5" /> Quick tips while you wait
                  </p>
                  {result.tips.map((tip, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.09 }}
                      className="flex items-start gap-3 bg-white/[0.04] rounded-xl p-3"
                    >
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5"
                        style={{ background: `${accent}20`, color: accent }}
                      >
                        {i + 1}
                      </span>
                      <p className="text-slate-300 text-sm leading-relaxed">{tip}</p>
                    </motion.div>
                  ))}
                </div>

              </div>
            </div>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="flex gap-3"
            >
              <Link
                href={`/customer/post-job?category=${result.category}`}
                className="flex-1 flex items-center justify-center gap-2 font-bold py-3.5 rounded-xl transition-colors text-sm"
                style={{ background: accent, color: "#0F172A" }}
              >
                Post this job
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={reset}
                className="px-5 py-3.5 bg-white/5 border border-white/10 text-slate-400 font-semibold rounded-xl hover:bg-white/10 hover:text-white transition-colors text-sm"
              >
                Start over
              </button>
            </motion.div>

            <p className="text-[11px] text-slate-500 leading-relaxed text-center">
              AI-generated estimate for guidance only — not a professional inspection.
              For gas, electrical, or flooding emergencies, call a licensed pro or 911.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

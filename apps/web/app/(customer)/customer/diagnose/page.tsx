"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Upload, Sparkles, Loader2, AlertTriangle, Clock,
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
  urgent:  { label: "Urgent — Fix Today",    icon: AlertTriangle, color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30"    },
  soon:    { label: "Fix Within a Week",      icon: Clock,         color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/30"  },
  routine: { label: "Schedule at Your Pace",  icon: CheckCircle2,  color: "text-emerald-400",bg: "bg-emerald-500/10",border: "border-emerald-500/30" },
};

const confidenceLabel = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" };
const confidenceColor  = { high: "text-emerald-400", medium: "text-amber-400",   low: "text-slate-400"  };

export default function DiagnosePage() {
  const [preview, setPreview]       = useState<string | null>(null);
  const [imageBase64, setBase64]    = useState<string | null>(null);
  const [mediaType, setMediaType]   = useState("image/jpeg");
  const [description, setDescription] = useState("");
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<Diagnosis | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [dragging, setDragging]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setMediaType(file.type as string);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      // Strip the data:image/...;base64, prefix
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
      if (!res.ok) { setError(data.error || "Analysis failed"); }
      else { setResult(data); }
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-tarea-sky" />
          <span className="text-tarea-sky text-sm font-semibold uppercase tracking-widest">AI-Powered</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white">Diagnose Your Issue</h1>
        <p className="text-slate-400 mt-1">Upload a photo or describe the problem — our AI will tell you exactly which pro you need.</p>
      </div>

      {/* Upload + Describe */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">

        {/* Image upload */}
        <div>
          <p className="text-slate-300 text-sm font-semibold mb-3">Photo of the issue <span className="text-slate-500 font-normal">(optional but recommended)</span></p>

          <AnimatePresence mode="wait">
            {preview ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="relative rounded-xl overflow-hidden border border-white/10"
              >
                <img src={preview} alt="Issue" className="w-full max-h-64 object-cover" />
                <button
                  onClick={reset}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
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
                  ${dragging ? "border-tarea-sky bg-tarea-sky/5" : "border-white/20 hover:border-white/40 hover:bg-white/[0.03]"}`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${dragging ? "bg-tarea-sky/20" : "bg-white/5"}`}>
                  <ImagePlus className={`w-6 h-6 ${dragging ? "text-tarea-sky" : "text-slate-500"}`} />
                </div>
                <div className="text-center">
                  <p className="text-slate-300 font-semibold text-sm">Drop a photo here or click to upload</p>
                  <p className="text-slate-500 text-xs mt-1">JPG, PNG or WebP · Max 5MB</p>
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

        {/* Description */}
        <div>
          <p className="text-slate-300 text-sm font-semibold mb-2">Describe the issue <span className="text-slate-500 font-normal">(optional)</span></p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. There's a wet patch on the ceiling that appeared after heavy rain, and I can see slight discoloration spreading…"
            rows={3}
            className="input resize-none text-sm"
          />
        </div>

        {/* Analyze button */}
        <button
          onClick={analyze}
          disabled={loading || (!imageBase64 && !description.trim())}
          className="w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: loading || (!imageBase64 && !description.trim())
              ? "rgba(255,255,255,0.05)"
              : "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" style={{ color: "#fff" }} /><span style={{ color: "#fff" }}>Analyzing…</span></>
            : <><Sparkles className="w-4 h-4" style={{ color: "#fff" }} /><span style={{ color: "#fff" }}>Diagnose My Issue</span></>
          }
        </button>
      </div>

      {/* Loading pulse */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 py-4"
          >
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  className="w-2.5 h-2.5 bg-tarea-sky rounded-full"
                />
              ))}
            </div>
            <p className="text-slate-400 text-sm">AI is analyzing your issue…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4"
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
            className="space-y-4"
          >
            {/* Main result card */}
            <div className="bg-white/5 border border-tarea-sky/30 rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-tarea-sky" />
                <span className="text-tarea-sky text-sm font-semibold">AI Diagnosis</span>
                <span className={`ml-auto text-xs font-semibold ${confidenceColor[result.confidence]}`}>
                  {confidenceLabel[result.confidence]}
                </span>
              </div>

              {/* Category */}
              <div className="flex items-center gap-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
                  className="w-16 h-16 bg-tarea-sky/15 border border-tarea-sky/30 rounded-2xl flex items-center justify-center flex-shrink-0"
                >
                  <CategoryIcon catKey={result.category} active className="w-8 h-8" />
                </motion.div>
                <div>
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-0.5">You need a</p>
                  <p className="text-white text-2xl font-extrabold">
                    {SERVICE_CATEGORY_LABELS[result.category] || result.category} Pro
                  </p>
                </div>
              </div>

              {/* Urgency badge */}
              <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border ${urgency.bg} ${urgency.border}`}>
                <urgency.icon className={`w-4.5 h-4.5 ${urgency.color} flex-shrink-0`} />
                <span className={`text-sm font-semibold ${urgency.color}`}>{urgency.label}</span>
              </div>

              {/* Explanation */}
              <p className="text-slate-300 text-sm leading-relaxed">{result.explanation}</p>

              {/* Tips */}
              <div className="space-y-2">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" /> While you wait for the pro
                </p>
                {result.tips.map((tip, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="flex items-start gap-2.5 bg-white/5 rounded-xl p-3"
                  >
                    <span className="w-5 h-5 bg-tarea-sky/20 text-tarea-sky rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-slate-300 text-sm">{tip}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex gap-3"
            >
              <Link
                href={`/customer/browse?category=${result.category}`}
                className="flex-1 flex items-center justify-center gap-2 bg-tarea-sky text-tarea-ink font-bold py-3.5 rounded-xl hover:bg-sky-300 transition-colors"
              >
                Book a {SERVICE_CATEGORY_LABELS[result.category] || "Pro"} Now
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={reset}
                className="px-5 py-3.5 bg-white/5 border border-white/10 text-slate-400 font-semibold rounded-xl hover:bg-white/10 hover:text-white transition-colors text-sm"
              >
                Try Again
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

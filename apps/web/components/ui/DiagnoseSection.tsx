"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Upload, Sparkles, Loader2, AlertTriangle, Clock,
  CheckCircle2, ArrowRight, X, ImagePlus, Lightbulb,
} from "lucide-react";
import { SERVICE_CATEGORY_LABELS } from "@/lib/utils";

type Diagnosis = {
  category: string;
  confidence: "high" | "medium" | "low";
  explanation: string;
  urgency: "urgent" | "soon" | "routine";
  tips: string[];
};

const urgencyConfig = {
  urgent:  { label: "Urgent — Fix Today",   icon: AlertTriangle, color: "text-red-500",    bg: "bg-red-50",    border: "border-red-200"   },
  soon:    { label: "Fix Within a Week",     icon: Clock,         color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200" },
  routine: { label: "Schedule at Your Pace", icon: CheckCircle2,  color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200" },
};

const confidenceColor = { high: "text-green-600", medium: "text-amber-600", low: "text-gray-400" };
const confidenceLabel = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" };

const CATEGORY_EMOJI: Record<string, string> = {
  PLUMBING: "🔧", ELECTRICAL: "⚡", CARPENTRY: "🪚", PAINTING: "🎨",
  CLEANING: "🧹", HVAC: "❄️", ROOFING: "🏠", LANDSCAPING: "🌿",
  MOVING: "📦", APPLIANCE_REPAIR: "🔌", GENERAL: "🛠️",
};

export default function DiagnoseSection() {
  const [preview, setPreview]     = useState<string | null>(null);
  const [imageBase64, setBase64]  = useState<string | null>(null);
  const [mediaType, setMediaType] = useState("image/jpeg");
  const [description, setDesc]    = useState("");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<Diagnosis | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [dragging, setDragging]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setMediaType(file.type);
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
    setPreview(null); setBase64(null);
    setDesc(""); setResult(null); setError(null);
  };

  const urgency = result ? urgencyConfig[result.urgency] : null;

  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-amber-50" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-14">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-orange-100 border border-orange-200 rounded-full px-4 py-1.5 mb-4"
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-orange-600 text-sm font-semibold">AI-Powered</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="text-5xl font-extrabold text-gray-900 mb-4"
          >
            Not Sure What You Need?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.14 }}
            className="text-gray-500 text-lg max-w-xl mx-auto"
          >
            Upload a photo of your home issue and our AI will instantly tell you which pro to call — no guesswork.
          </motion.p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-start">

          {/* Left — input */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-white border border-orange-100 rounded-3xl p-7 shadow-[0_4px_24px_rgba(251,146,60,0.10)] space-y-5"
          >
            {/* Upload zone */}
            <div>
              <p className="text-gray-700 text-sm font-semibold mb-3">
                Upload a photo <span className="text-gray-400 font-normal">(recommended)</span>
              </p>
              <AnimatePresence mode="wait">
                {preview ? (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="relative rounded-2xl overflow-hidden border border-orange-100"
                  >
                    <img src={preview} alt="Issue" className="w-full max-h-52 object-cover" />
                    <button
                      onClick={reset}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
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
                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all duration-200
                      ${dragging ? "border-orange-400 bg-orange-50" : "border-orange-200 hover:border-orange-400 hover:bg-orange-50/50"}`}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${dragging ? "bg-orange-100" : "bg-orange-50"}`}>
                      <ImagePlus className={`w-6 h-6 ${dragging ? "text-orange-500" : "text-orange-300"}`} />
                    </div>
                    <div className="text-center">
                      <p className="text-gray-700 font-semibold text-sm">Drop photo here or click to upload</p>
                      <p className="text-gray-400 text-xs mt-1">JPG, PNG, WebP</p>
                    </div>
                    <span className="flex items-center gap-1.5 text-orange-500 text-sm font-semibold">
                      <Upload className="w-4 h-4" /> Choose Photo
                    </span>
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
              <p className="text-gray-700 text-sm font-semibold mb-2">Or describe the problem</p>
              <textarea
                value={description}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="e.g. There's a wet patch on my ceiling that appeared after heavy rain…"
                rows={3}
                className="w-full border border-orange-100 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-orange-300 transition"
              />
            </div>

            {/* Analyze button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={analyze}
              disabled={loading || (!imageBase64 && !description.trim())}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white font-bold py-3.5 rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Analyzing…</span></>
                : <><Sparkles className="w-4 h-4" /><span>Diagnose My Issue</span></>
              }
            </motion.button>

            {/* Loading pulse */}
            <AnimatePresence>
              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center gap-1.5 pt-1"
                >
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                      className="w-2 h-2 bg-orange-400 rounded-full"
                    />
                  ))}
                  <span className="text-gray-400 text-xs ml-2">AI is analyzing your issue…</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Right — result or placeholder */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <AnimatePresence mode="wait">
              {/* Error */}
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-5"
                >
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-600 text-sm">{error}</p>
                </motion.div>
              )}

              {/* Result */}
              {result && urgency && !error && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="bg-white border border-orange-100 rounded-3xl p-7 shadow-[0_4px_24px_rgba(251,146,60,0.10)] space-y-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-orange-500 text-sm font-semibold">
                      <Sparkles className="w-4 h-4" /> AI Diagnosis
                    </span>
                    <span className={`text-xs font-semibold ${confidenceColor[result.confidence]}`}>
                      {confidenceLabel[result.confidence]}
                    </span>
                  </div>

                  {/* Category */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-center gap-4"
                  >
                    <div className="w-16 h-16 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">
                      {CATEGORY_EMOJI[result.category] || "🛠️"}
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">You need a</p>
                      <p className="text-gray-900 text-2xl font-extrabold">
                        {SERVICE_CATEGORY_LABELS[result.category] || result.category} Pro
                      </p>
                    </div>
                  </motion.div>

                  {/* Urgency */}
                  <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border ${urgency.bg} ${urgency.border}`}>
                    <urgency.icon className={`w-4 h-4 ${urgency.color} flex-shrink-0`} />
                    <span className={`text-sm font-semibold ${urgency.color}`}>{urgency.label}</span>
                  </div>

                  {/* Explanation */}
                  <p className="text-gray-600 text-sm leading-relaxed">{result.explanation}</p>

                  {/* Tips */}
                  <div className="space-y-2">
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5" /> While you wait
                    </p>
                    {result.tips.map((tip, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + i * 0.1 }}
                        className="flex items-start gap-2.5 bg-orange-50 rounded-xl p-3"
                      >
                        <span className="w-5 h-5 bg-orange-200 text-orange-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-gray-700 text-sm">{tip}</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* CTA */}
                  <div className="flex gap-3 pt-1">
                    <Link
                      href={`/register?category=${result.category}`}
                      className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                    >
                      Book a {SERVICE_CATEGORY_LABELS[result.category] || "Pro"} Now
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={reset}
                      className="px-4 py-3 border border-gray-200 text-gray-500 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Placeholder when no result yet */}
              {!result && !error && !loading && (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="border-2 border-dashed border-orange-200 rounded-3xl p-10 flex flex-col items-center justify-center gap-4 text-center min-h-[320px]"
                >
                  <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center text-3xl">🔍</div>
                  <div>
                    <p className="text-gray-700 font-bold text-lg">Your diagnosis will appear here</p>
                    <p className="text-gray-400 text-sm mt-1">Upload a photo or describe the issue to get started</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {["Leaking pipe?", "Flickering lights?", "Damp walls?", "Broken AC?"].map(ex => (
                      <button
                        key={ex}
                        onClick={() => setDesc(ex.replace("?", ""))}
                        className="text-xs bg-orange-50 border border-orange-200 text-orange-600 px-3 py-1.5 rounded-full hover:bg-orange-100 transition-colors font-medium"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

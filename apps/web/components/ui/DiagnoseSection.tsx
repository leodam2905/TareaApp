"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Upload, Camera, Sparkles, Loader2, AlertTriangle, Clock,
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);

  const openCamera = async () => {
    try {
      // Triggers the browser's camera-permission prompt.
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setError("Couldn't access the camera. Allow camera permission, or upload a photo instead.");
    }
  };

  // Hybrid: native camera app on phones, in-page webcam preview on desktop.
  const takePhoto = () => {
    const isMobile = typeof navigator !== "undefined" && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
    if (isMobile) cameraRef.current?.click();
    else openCamera();
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) handleFile(new File([blob], "camera-photo.jpg", { type: "image/jpeg" }));
      closeCamera();
    }, "image/jpeg", 0.9);
  };

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOpen]);

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
    <section className="relative mx-4 sm:mx-6 lg:mx-auto max-w-7xl my-8 rounded-3xl border border-gray-200 bg-gray-50 overflow-hidden py-4 sm:py-6">
      <div className="absolute inset-0 bg-gray-50" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-4">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="text-3xl font-extrabold text-gray-900 mb-2"
          >
            Not Sure What You Need?
          </motion.h2>
        </div>

        <div className="grid lg:grid-cols-[3fr_2fr] gap-8 items-stretch">

          {/* Illustration */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center lg:h-full"
          >
            <motion.img
              src="/diagnose.png"
              alt="Diagnose your home issue with AI"
              className="w-full h-auto lg:h-full lg:w-auto lg:max-w-full object-contain"
              animate={{ y: [0, -14, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>

          {/* Right — upload + diagnostic stacked */}
          <div className="space-y-4">

          {/* Upload / input */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-white border border-violet-100 rounded-3xl p-3 shadow-[0_4px_24px_rgba(139,92,246,0.12)] space-y-3"
          >
            {/* Upload zone */}
            <div>
              <p className="text-gray-700 text-sm font-semibold mb-3">
                Upload a picture or take a picture
              </p>
              <AnimatePresence mode="wait">
                {preview ? (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="relative rounded-2xl overflow-hidden border border-violet-100"
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
                    className={`border-2 border-dashed rounded-2xl p-3 flex flex-col items-center gap-2 cursor-pointer transition-all duration-200
                      ${dragging ? "border-violet-400 bg-violet-50" : "border-violet-200 hover:border-violet-400 hover:bg-violet-50/50"}`}
                  >
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${dragging ? "bg-violet-100" : "bg-violet-50"}`}>
                      <ImagePlus className={`w-5 h-5 ${dragging ? "text-violet-500" : "text-violet-300"}`} />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                        className="flex items-center gap-1.5 bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Upload className="w-4 h-4" /> Upload
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); takePhoto(); }}
                        className="flex items-center gap-1.5 bg-white border border-violet-200 hover:border-violet-400 text-violet-600 text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Camera className="w-4 h-4" /> Take Photo
                      </button>
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
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
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
                rows={1}
                className="w-full border border-violet-100 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 transition"
              />
            </div>

            {/* Analyze button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={analyze}
              disabled={loading || (!imageBase64 && !description.trim())}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold py-2.5 rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
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
                      className="w-2 h-2 bg-violet-400 rounded-full"
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
                  className="bg-white border border-violet-100 rounded-3xl p-3 shadow-[0_4px_24px_rgba(139,92,246,0.12)] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-violet-500 text-sm font-semibold">
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
                    <div className="w-16 h-16 bg-violet-50 border border-violet-200 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">
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
                        className="flex items-start gap-2.5 bg-violet-50 rounded-xl p-3"
                      >
                        <span className="w-5 h-5 bg-violet-200 text-violet-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
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
                      className="flex-1 flex items-center justify-center gap-2 bg-violet-500 hover:bg-violet-600 text-white font-bold py-3 rounded-xl transition-colors text-sm"
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

                  <p className="text-[11px] text-gray-400 leading-relaxed text-center pt-1">
                    AI-generated estimate for guidance only — not a professional inspection.
                    For gas, electrical, or flooding emergencies, call a licensed pro or 911.
                  </p>
                </motion.div>
              )}

              {/* Placeholder when no result yet */}
              {!result && !error && !loading && (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="border-2 border-dashed border-violet-200 rounded-3xl p-10 flex flex-col items-center justify-center gap-4 text-center min-h-[320px]"
                >
                  <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center text-3xl">🔍</div>
                  <div>
                    <p className="text-gray-700 font-bold text-lg">Your diagnosis will appear here</p>
                    <p className="text-gray-400 text-sm mt-1">Upload a photo or describe the issue to get started</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {["Leaking pipe?", "Flickering lights?", "Damp walls?", "Broken AC?"].map(ex => (
                      <button
                        key={ex}
                        onClick={() => setDesc(ex.replace("?", ""))}
                        className="text-xs bg-violet-50 border border-violet-200 text-violet-600 px-3 py-1.5 rounded-full hover:bg-violet-100 transition-colors font-medium"
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
      </div>
      {/* Camera capture overlay */}
      {cameraOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4">
          <video ref={videoRef} playsInline muted className="max-w-full max-h-[70vh] rounded-2xl bg-black" />
          <div className="flex items-center gap-3 mt-6">
            <button type="button" onClick={capturePhoto} className="flex items-center gap-2 bg-violet-500 hover:bg-violet-600 text-white font-bold px-6 py-3 rounded-xl transition-colors">
              <Camera className="w-5 h-5" /> Capture
            </button>
            <button type="button" onClick={closeCamera} className="bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Zap, Loader2, BadgeCheck, ArrowRight, Clock, ChevronDown, RotateCcw } from "lucide-react";

// ─── Task catalogue ───────────────────────────────────────────────────────────

type DetailField = { key: string; label: string; options: string[] };
type Task = { label: string; details: DetailField[] };

const TASKS: Record<string, Task[]> = {
  Plumbing: [
    { label: "Fix Leaky Faucet", details: [
      { key: "location",    label: "Location",            options: ["Kitchen", "Bathroom", "Outdoor"] },
      { key: "parts",       label: "Parts supplied by",   options: ["Me (customer)", "Handyman"] },
    ]},
    { label: "Unclog Drain", details: [
      { key: "drain",       label: "Which drain?",        options: ["Kitchen sink", "Bathroom sink", "Shower / tub", "Toilet"] },
    ]},
    { label: "Install Toilet", details: [
      { key: "supplied",    label: "Toilet supplied by",  options: ["Me (customer)", "Handyman"] },
    ]},
    { label: "Replace Water Heater", details: [
      { key: "type",        label: "Type",                options: ["Tank (electric)", "Tank (gas)", "Tankless"] },
      { key: "unit",        label: "Unit supplied by",    options: ["Me (customer)", "Handyman"] },
    ]},
  ],
  Electrical: [
    { label: "Install Ceiling Fan", details: [
      { key: "height",      label: "Ceiling height",      options: ["8 ft", "9 ft", "10+ ft", "Vaulted"] },
      { key: "preWired",    label: "Pre-wired box?",      options: ["Yes", "No — needs new wiring"] },
      { key: "fan",         label: "Fan supplied by",     options: ["Me (customer)", "Handyman"] },
    ]},
    { label: "Replace Outlet / Switch", details: [
      { key: "qty",         label: "How many?",           options: ["1", "2–3", "4–6", "7+"] },
      { key: "type",        label: "Outlet type",         options: ["Standard", "GFCI", "USB combo"] },
    ]},
    { label: "Install Light Fixture", details: [
      { key: "qty",         label: "Number of fixtures",  options: ["1", "2–3", "4+"] },
      { key: "fixture",     label: "Fixture supplied by", options: ["Me (customer)", "Handyman"] },
    ]},
  ],
  Carpentry: [
    { label: "Assemble Furniture", details: [
      { key: "pieces",      label: "Number of pieces",    options: ["1", "2–3", "4–6", "7+"] },
      { key: "size",        label: "Largest piece size",  options: ["Small (chair, table)", "Medium (dresser, desk)", "Large (wardrobe, bed frame)"] },
    ]},
    { label: "Install Shelving", details: [
      { key: "shelves",     label: "Number of shelves",   options: ["1–2", "3–5", "6+"] },
      { key: "wall",        label: "Wall type",           options: ["Drywall", "Concrete / brick", "Tile"] },
    ]},
    { label: "Fix / Hang Door", details: [
      { key: "issue",       label: "Issue",               options: ["Won't close or latch", "Squeaking hinge", "Install new door", "Install door hardware"] },
    ]},
  ],
  Painting: [
    { label: "Paint a Room", details: [
      { key: "size",        label: "Room size",           options: ["Small < 150 sq ft", "Medium 150–300 sq ft", "Large 300+ sq ft"] },
      { key: "paint",       label: "Paint supplied by",   options: ["Me (customer)", "Handyman"] },
      { key: "coats",       label: "Number of coats",     options: ["1 coat", "2 coats"] },
    ]},
    { label: "Patch & Paint Wall", details: [
      { key: "patches",     label: "Damage level",        options: ["1–2 small holes", "3–5 holes", "Large area repair"] },
    ]},
  ],
  Cleaning: [
    { label: "Deep Clean", details: [
      { key: "beds",        label: "Bedrooms",            options: ["Studio / 1BR", "2BR", "3BR", "4BR+"] },
      { key: "baths",       label: "Bathrooms",           options: ["1", "2", "3+"] },
    ]},
    { label: "Move-Out Clean", details: [
      { key: "beds",        label: "Bedrooms",            options: ["Studio / 1BR", "2BR", "3BR", "4BR+"] },
      { key: "condition",   label: "Condition",           options: ["Good", "Fair", "Heavy dirt / grease"] },
    ]},
    { label: "Wash & Fold (pickup)", details: [
      { key: "bags",        label: "Laundry bags",        options: ["1 bag (~15 lbs)", "2 bags", "3+ bags"] },
      { key: "turnaround",  label: "Turnaround",          options: ["Standard (24 hrs)", "Same day (+$15)"] },
    ]},
  ],
  Moving: [
    { label: "Local Move", details: [
      { key: "size",        label: "Home size",           options: ["Studio / 1BR", "2BR", "3BR", "4BR+"] },
      { key: "distance",    label: "Distance",            options: ["< 5 miles", "5–15 miles", "15–30 miles", "30+ miles"] },
      { key: "packing",     label: "Need packing help?",  options: ["No — just moving boxes", "Yes — pack & move"] },
    ]},
    { label: "Furniture Delivery & Setup", details: [
      { key: "pieces",      label: "Number of pieces",    options: ["1", "2–3", "4+"] },
    ]},
  ],
  General: [
    { label: "TV Mounting", details: [
      { key: "tvSize",      label: "TV size",             options: ['Under 40"', '40–55"', '55–75"', '75"+'] },
      { key: "wall",        label: "Wall type",           options: ["Drywall", "Concrete / brick", "Tile"] },
      { key: "mount",       label: "Bracket supplied by", options: ["Me (customer)", "Handyman"] },
    ]},
    { label: "Picture / Mirror Hanging", details: [
      { key: "qty",         label: "How many items?",     options: ["1–2", "3–5", "6+"] },
      { key: "weight",      label: "Heaviest item",       options: ["Light < 10 lbs", "Medium 10–30 lbs", "Heavy 30+ lbs"] },
    ]},
    { label: "Gutter Cleaning", details: [
      { key: "stories",     label: "Home stories",        options: ["1 story", "2 stories", "3+ stories"] },
      { key: "length",      label: "Approx. gutter length", options: ["< 100 ft", "100–200 ft", "200+ ft"] },
    ]},
    { label: "Assembly & Mounting", details: [
      { key: "item",        label: "What to assemble?",   options: ["TV stand / entertainment center", "Desk / workstation", "Shelving unit", "Exercise equipment", "Other furniture"] },
      { key: "complexity",  label: "Complexity",          options: ["Simple (< 30 min)", "Medium (30–90 min)", "Complex (2+ hrs)"] },
    ]},
  ],
};

const CATEGORIES = Object.keys(TASKS);

// ─── Quote type ───────────────────────────────────────────────────────────────

type Quote = {
  minPrice: number;
  maxPrice: number;
  duration: string;
  includes: string[];
  note: string;
  confidence: "guaranteed" | "estimate";
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_API: Record<string, string> = {
  Plumbing: "PLUMBING", Electrical: "ELECTRICAL", Carpentry: "CARPENTRY",
  Painting: "PAINTING", Cleaning: "CLEANING", Moving: "MOVING", General: "GENERAL",
};

function ChipButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-150 ${
        selected
          ? "bg-gray-900 text-white border-gray-900"
          : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export default function InstantQuoteSection() {
  const [category, setCategory] = useState<string | null>(null);
  const [task, setTask]         = useState<Task | null>(null);
  const [details, setDetails]   = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(false);
  const [quote, setQuote]       = useState<Quote | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const selectCategory = (c: string) => {
    setCategory(c); setTask(null); setDetails({}); setQuote(null); setError(null);
  };

  const selectTask = (t: Task) => {
    setTask(t); setDetails({}); setQuote(null); setError(null);
  };

  const setDetail = (key: string, val: string) =>
    setDetails(prev => ({ ...prev, [key]: val }));

  const allDetailsFilled = task
    ? task.details.every(d => details[d.key])
    : false;

  const canQuote = task && (task.details.length === 0 || allDetailsFilled);

  const getQuote = async () => {
    if (!category || !task) return;
    setLoading(true); setError(null); setQuote(null);
    try {
      const res = await fetch("/api/ai/instant-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: CATEGORY_API[category], task: task.label, details }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Could not generate quote");
      else setQuote(data);
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  const reset = () => {
    setCategory(null); setTask(null); setDetails({}); setQuote(null); setError(null);
  };

  return (
    <section className="py-28 bg-gray-950 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-400/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Heading */}
        <div className="text-center mb-14">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-4"
          >
            <Zap className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-orange-400 text-sm font-semibold">No Surprises</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="text-5xl font-extrabold text-white mb-4"
          >
            Get an Instant Quote
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.14 }}
            className="text-gray-400 text-lg max-w-xl mx-auto"
          >
            Tell us what you need — we'll give you a guaranteed price range before you book. No consultations, no hidden fees.
          </motion.p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">

          {/* ── Left: configurator ── */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-7 space-y-7"
          >

            {/* Step 1: Category */}
            <div>
              <p className="text-white text-sm font-bold mb-3 flex items-center gap-2">
                <span className="w-5 h-5 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-black">1</span>
                Choose a service
              </p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <ChipButton key={c} label={c} selected={category === c} onClick={() => selectCategory(c)} />
                ))}
              </div>
            </div>

            {/* Step 2: Task */}
            <AnimatePresence>
              {category && (
                <motion.div
                  key="task-step"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-white text-sm font-bold mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-black">2</span>
                    What specifically?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {TASKS[category].map(t => (
                      <ChipButton key={t.label} label={t.label} selected={task?.label === t.label} onClick={() => selectTask(t)} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step 3: Details */}
            <AnimatePresence>
              {task && task.details.length > 0 && (
                <motion.div
                  key="detail-step"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <p className="text-white text-sm font-bold flex items-center gap-2">
                    <span className="w-5 h-5 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-black">3</span>
                    A few details
                  </p>
                  {task.details.map(d => (
                    <div key={d.key}>
                      <label className="text-gray-400 text-xs font-semibold mb-2 block">{d.label}</label>
                      <div className="flex flex-wrap gap-2">
                        {d.options.map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setDetail(d.key, opt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 ${
                              details[d.key] === opt
                                ? "bg-orange-500 text-white border-orange-500"
                                : "bg-white/5 text-gray-400 border-white/10 hover:border-white/30 hover:text-white"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* CTA */}
            <AnimatePresence>
              {task && (
                <motion.div
                  key="cta"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <button
                    type="button"
                    onClick={getQuote}
                    disabled={loading || !canQuote}
                    className="w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: "linear-gradient(135deg, #F97316 0%, #FB923C 100%)",
                      color: "#fff",
                    }}
                  >
                    {loading
                      ? <><Loader2 className="w-4 h-4 animate-spin" style={{ color: "#fff" }} /><span style={{ color: "#fff" }}>Calculating…</span></>
                      : <><Zap className="w-4 h-4" style={{ color: "#fff" }} /><span style={{ color: "#fff" }}>Get My Instant Quote</span></>
                    }
                  </button>
                  {task.details.length > 0 && !allDetailsFilled && (
                    <p className="text-gray-500 text-xs text-center mt-2">Select all options above to get your quote</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>

          {/* ── Right: result ── */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <AnimatePresence mode="wait">

              {/* Error */}
              {error && (
                <motion.div key="error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-red-400 text-sm"
                >
                  {error}
                </motion.div>
              )}

              {/* Loading pulse */}
              {loading && !quote && (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-4 py-16"
                >
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map(i => (
                      <motion.div key={i}
                        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                        className="w-2.5 h-2.5 bg-orange-500 rounded-full"
                      />
                    ))}
                  </div>
                  <p className="text-gray-500 text-sm">Calculating your price…</p>
                </motion.div>
              )}

              {/* Quote result */}
              {quote && !loading && (
                <motion.div key="quote" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="bg-white/5 border border-white/10 rounded-3xl p-7 space-y-6"
                >
                  {/* Confidence badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Your quote</span>
                    <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${
                      quote.confidence === "guaranteed"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-amber-500/15 text-amber-400"
                    }`}>
                      <BadgeCheck className="w-3.5 h-3.5" />
                      {quote.confidence === "guaranteed" ? "Price Guaranteed" : "Price Estimate"}
                    </span>
                  </div>

                  {/* Price */}
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}>
                    <p className="text-6xl font-black text-white">
                      ${quote.minPrice}
                      <span className="text-3xl text-gray-500 font-bold"> – ${quote.maxPrice}</span>
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 text-gray-400 text-sm">
                      <Clock className="w-4 h-4" /> {quote.duration}
                    </div>
                  </motion.div>

                  {/* Includes */}
                  <div className="space-y-2">
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">What's included</p>
                    {quote.includes.map((item, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.08 }}
                        className="flex items-center gap-2.5"
                      >
                        <div className="w-4 h-4 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                        </div>
                        <span className="text-gray-300 text-sm">{item}</span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Note */}
                  {quote.note && (
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3">
                      <p className="text-orange-300 text-xs leading-relaxed">
                        <span className="font-bold">Note: </span>{quote.note}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-1">
                    <Link
                      href="/register"
                      className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                    >
                      Book at This Price <ArrowRight className="w-4 h-4" />
                    </Link>
                    <button type="button" onClick={reset}
                      className="px-4 py-3 bg-white/5 border border-white/10 text-gray-400 text-sm rounded-xl hover:bg-white/10 hover:text-white transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Placeholder */}
              {!quote && !loading && !error && (
                <motion.div key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="border-2 border-dashed border-white/10 rounded-3xl p-10 flex flex-col items-center justify-center gap-5 text-center min-h-[380px]"
                >
                  <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center">
                    <Zap className="w-8 h-8 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg">Your instant quote appears here</p>
                    <p className="text-gray-500 text-sm mt-1 max-w-xs">Select a service and task on the left to see a guaranteed price before you book</p>
                  </div>
                  {/* Popular quick-picks */}
                  <div className="space-y-1.5 w-full">
                    <p className="text-gray-600 text-xs font-semibold uppercase tracking-wider">Popular</p>
                    {[
                      { label: "Install Ceiling Fan", cat: "Electrical" },
                      { label: "Deep Clean (2BR)",    cat: "Cleaning"   },
                      { label: "TV Mounting",          cat: "General"    },
                    ].map(({ label, cat }) => (
                      <button key={label} type="button"
                        onClick={() => {
                          selectCategory(cat);
                          const found = TASKS[cat].find(t => t.label === label || label.startsWith(t.label.split(" ")[0]));
                          if (found) selectTask(found);
                        }}
                        className="w-full text-left flex items-center justify-between px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all text-sm group"
                      >
                        <span className="text-gray-300 font-medium">{label}</span>
                        <ChevronDown className="w-4 h-4 text-gray-600 -rotate-90 group-hover:text-orange-400 transition-colors" />
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

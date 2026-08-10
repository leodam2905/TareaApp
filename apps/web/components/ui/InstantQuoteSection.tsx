"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Zap, Loader2, BadgeCheck, ArrowRight, Clock, ChevronRight, RotateCcw, CheckCircle } from "lucide-react";
import { Droplet, Snowflake, Hammer, Paintbrush, Home, Sparkles, Leaf, Refrigerator, Truck, Wrench, type LucideIcon } from "lucide-react";

// Rotating "popular requests" shown in the placeholder. The icon comes from the
// category so there's one place to change it.
const POPULAR = [
  { label: "Install Ceiling Fan", cat: "Electrical"  },
  { label: "AC Tune-Up",           cat: "HVAC"        },
  { label: "Lawn Mowing",          cat: "Landscaping" },
  { label: "TV Mounting",          cat: "General"     },
  { label: "Fix Leaky Faucet",     cat: "Plumbing"    },
];

type DetailField = { key: string; label: string; options: string[] };
type Task        = { label: string; details: DetailField[] };
type Quote       = { minPrice: number; maxPrice: number; duration: string; includes: string[]; note: string; confidence: "guaranteed" | "estimate" };

const TASKS: Record<string, Task[]> = {
  Plumbing: [
    { label: "Fix Leaky Faucet",        details: [{ key: "location", label: "Location",           options: ["Kitchen", "Bathroom", "Outdoor"] }, { key: "parts",    label: "Parts supplied by",  options: ["Me (customer)", "Handyman"] }] },
    { label: "Unclog Drain",             details: [{ key: "drain",    label: "Which drain?",        options: ["Kitchen sink", "Bathroom sink", "Shower / tub", "Toilet"] }] },
    { label: "Install Toilet",           details: [{ key: "supplied", label: "Toilet supplied by",  options: ["Me (customer)", "Handyman"] }] },
    { label: "Replace Water Heater",     details: [{ key: "type",     label: "Type",                options: ["Tank (electric)", "Tank (gas)", "Tankless"] }, { key: "unit", label: "Unit supplied by", options: ["Me (customer)", "Handyman"] }] },
  ],
  Electrical: [
    { label: "Install Ceiling Fan",      details: [{ key: "height",   label: "Ceiling height",      options: ["8 ft", "9 ft", "10+ ft", "Vaulted"] }, { key: "preWired", label: "Pre-wired box?", options: ["Yes", "No — needs new wiring"] }, { key: "fan", label: "Fan supplied by", options: ["Me (customer)", "Handyman"] }] },
    { label: "Replace Outlet / Switch",  details: [{ key: "qty",      label: "How many?",           options: ["1", "2–3", "4–6", "7+"] }, { key: "type", label: "Outlet type", options: ["Standard", "GFCI", "USB combo"] }] },
    { label: "Install Light Fixture",    details: [{ key: "qty",      label: "Number of fixtures",  options: ["1", "2–3", "4+"] }, { key: "fixture", label: "Fixture supplied by", options: ["Me (customer)", "Handyman"] }] },
    { label: "Install EV Charger",       details: [{ key: "level",    label: "Charger level",       options: ["Level 1 (120V)", "Level 2 (240V)"] }, { key: "unit", label: "Charger supplied by", options: ["Me (customer)", "Handyman"] }] },
  ],
  HVAC: [
    { label: "AC Tune-Up",               details: [{ key: "type",     label: "AC type",             options: ["Central / split", "Window unit", "Mini-split"] }] },
    { label: "Heating System Service",   details: [{ key: "type",     label: "System type",         options: ["Furnace (gas)", "Furnace (electric)", "Heat pump", "Boiler"] }] },
    { label: "Install Thermostat",       details: [{ key: "kind",     label: "Thermostat type",     options: ["Manual / basic", "Programmable", "Smart (Nest, Ecobee)"] }, { key: "unit", label: "Thermostat supplied by", options: ["Me (customer)", "Handyman"] }] },
    { label: "Duct Cleaning",            details: [{ key: "size",     label: "Home size",           options: ["< 1,000 sq ft", "1,000–2,000 sq ft", "2,000+ sq ft"] }] },
  ],
  Carpentry: [
    { label: "Assemble Furniture",       details: [{ key: "pieces",   label: "Number of pieces",    options: ["1", "2–3", "4–6", "7+"] }, { key: "size", label: "Largest piece size", options: ["Small (chair, table)", "Medium (dresser, desk)", "Large (wardrobe, bed frame)"] }] },
    { label: "Install Shelving",         details: [{ key: "shelves",  label: "Number of shelves",   options: ["1–2", "3–5", "6+"] }, { key: "wall", label: "Wall type", options: ["Drywall", "Concrete / brick", "Tile"] }] },
    { label: "Fix / Hang Door",          details: [{ key: "issue",    label: "Issue",               options: ["Won't close or latch", "Squeaking hinge", "Install new door", "Install door hardware"] }] },
    { label: "Build / Repair Deck",      details: [{ key: "work",     label: "Type of work",        options: ["Repair / replace boards", "Add railing", "Build new deck"] }, { key: "size", label: "Deck size", options: ["Small < 100 sq ft", "Medium 100–300 sq ft", "Large 300+ sq ft"] }] },
  ],
  Painting: [
    { label: "Paint a Room",             details: [{ key: "size",     label: "Room size",           options: ["Small < 150 sq ft", "Medium 150–300 sq ft", "Large 300+ sq ft"] }, { key: "paint", label: "Paint supplied by", options: ["Me (customer)", "Handyman"] }, { key: "coats", label: "Number of coats", options: ["1 coat", "2 coats"] }] },
    { label: "Patch & Paint Wall",       details: [{ key: "patches",  label: "Damage level",        options: ["1–2 small holes", "3–5 holes", "Large area repair"] }] },
    { label: "Paint Exterior",           details: [{ key: "area",     label: "Area",                options: ["Front door / trim", "Full house exterior"] }, { key: "paint", label: "Paint supplied by", options: ["Me (customer)", "Handyman"] }] },
    { label: "Cabinet Painting",         details: [{ key: "qty",      label: "Number of cabinets",  options: ["Up to 10", "11–20", "21+"] }, { key: "paint", label: "Paint supplied by", options: ["Me (customer)", "Handyman"] }] },
  ],
  Roofing: [
    { label: "Roof Inspection",          details: [{ key: "stories",  label: "Home stories",        options: ["1 story", "2 stories", "3+ stories"] }] },
    { label: "Repair Roof Leak",         details: [{ key: "location", label: "Leak location",       options: ["Around chimney / vent", "Flat section", "Ridge / peak", "General / unknown"] }, { key: "stories", label: "Home stories", options: ["1 story", "2 stories", "3+ stories"] }] },
    { label: "Replace Shingles",         details: [{ key: "area",     label: "Affected area",       options: ["Small patch < 10 sq ft", "Medium 10–50 sq ft", "Large 50+ sq ft"] }, { key: "stories", label: "Home stories", options: ["1 story", "2 stories", "3+ stories"] }] },
    { label: "Gutter Repair / Replace",  details: [{ key: "work",     label: "Type of work",        options: ["Reseal leaking seam", "Replace a section", "Replace all gutters"] }, { key: "stories", label: "Home stories", options: ["1 story", "2 stories", "3+ stories"] }] },
  ],
  Cleaning: [
    { label: "Deep Clean",               details: [{ key: "beds",     label: "Bedrooms",            options: ["Studio / 1BR", "2BR", "3BR", "4BR+"] }, { key: "baths", label: "Bathrooms", options: ["1", "2", "3+"] }] },
    { label: "Move-Out Clean",           details: [{ key: "beds",     label: "Bedrooms",            options: ["Studio / 1BR", "2BR", "3BR", "4BR+"] }, { key: "condition", label: "Condition", options: ["Good", "Fair", "Heavy dirt / grease"] }] },
    { label: "Carpet Cleaning",          details: [{ key: "rooms",    label: "Number of rooms",     options: ["1", "2–3", "4–5", "6+"] }, { key: "condition", label: "Carpet condition", options: ["Lightly soiled", "Moderately soiled", "Heavily stained"] }] },
    { label: "Wash & Fold (pickup)",     details: [{ key: "bags",     label: "Laundry bags",        options: ["1 bag (~15 lbs)", "2 bags", "3+ bags"] }, { key: "turnaround", label: "Turnaround", options: ["Standard (24 hrs)", "Same day (+$15)"] }] },
  ],
  Landscaping: [
    { label: "Lawn Mowing",              details: [{ key: "size",     label: "Lawn size",           options: ["Small < 2,000 sq ft", "Medium 2,000–5,000 sq ft", "Large 5,000+ sq ft"] }, { key: "frequency", label: "Frequency", options: ["One-time", "Weekly", "Bi-weekly"] }] },
    { label: "Hedge / Tree Trimming",    details: [{ key: "qty",      label: "Number of shrubs / trees", options: ["1–3", "4–8", "9+"] }, { key: "height", label: "Max height", options: ["Under 6 ft", "6–12 ft", "12+ ft"] }] },
    { label: "Leaf Cleanup",             details: [{ key: "size",     label: "Yard size",           options: ["Small", "Medium", "Large"] }, { key: "haul", label: "Haul away debris?", options: ["Yes", "No — leave in bags"] }] },
    { label: "Garden Bed Maintenance",   details: [{ key: "beds",     label: "Number of beds",      options: ["1–2", "3–5", "6+"] }, { key: "work", label: "Services needed", options: ["Weed & mulch", "Plant new plants", "Both"] }] },
  ],
  "Appliance Repair": [
    { label: "Washing Machine Repair",   details: [{ key: "brand",    label: "Brand",               options: ["Samsung", "LG", "Whirlpool", "GE", "Other"] }, { key: "issue", label: "Issue", options: ["Won't start", "Won't drain / spin", "Leaking", "Noisy", "Other"] }] },
    { label: "Dryer Repair",             details: [{ key: "fuel",     label: "Dryer type",          options: ["Electric", "Gas"] }, { key: "issue", label: "Issue", options: ["Won't heat", "Won't start", "Noisy", "Takes too long", "Other"] }] },
    { label: "Dishwasher Repair",        details: [{ key: "brand",    label: "Brand",               options: ["Bosch", "Samsung", "LG", "Whirlpool", "Other"] }, { key: "issue", label: "Issue", options: ["Won't start", "Not cleaning well", "Leaking", "Won't drain", "Other"] }] },
    { label: "Refrigerator Repair",      details: [{ key: "issue",    label: "Issue",               options: ["Not cooling", "Leaking water", "Ice maker broken", "Noisy / vibrating", "Other"] }] },
  ],
  Moving: [
    { label: "Local Move",               details: [{ key: "size",     label: "Home size",           options: ["Studio / 1BR", "2BR", "3BR", "4BR+"] }, { key: "distance", label: "Distance", options: ["< 5 miles", "5–15 miles", "15–30 miles", "30+ miles"] }, { key: "packing", label: "Need packing help?", options: ["No — just moving boxes", "Yes — pack & move"] }] },
    { label: "Furniture Delivery",       details: [{ key: "pieces",   label: "Number of pieces",    options: ["1", "2–3", "4+"] }] },
    { label: "Junk Removal",             details: [{ key: "volume",   label: "Amount of junk",      options: ["A few items", "Half truck load", "Full truck load"] }, { key: "location", label: "Location", options: ["Curbside / easy access", "Inside home", "Upstairs / basement"] }] },
  ],
  General: [
    { label: "TV Mounting",              details: [{ key: "tvSize",   label: "TV size",             options: ['Under 40"', '40–55"', '55–75"', '75"+'] }, { key: "wall", label: "Wall type", options: ["Drywall", "Concrete / brick", "Tile"] }, { key: "mount", label: "Bracket supplied by", options: ["Me (customer)", "Handyman"] }] },
    { label: "Picture Hanging",          details: [{ key: "qty",      label: "How many items?",     options: ["1–2", "3–5", "6+"] }, { key: "weight", label: "Heaviest item", options: ["Light < 10 lbs", "Medium 10–30 lbs", "Heavy 30+ lbs"] }] },
    { label: "Gutter Cleaning",          details: [{ key: "stories",  label: "Home stories",        options: ["1 story", "2 stories", "3+ stories"] }, { key: "length", label: "Approx. gutter length", options: ["< 100 ft", "100–200 ft", "200+ ft"] }] },
    { label: "Assembly & Mounting",      details: [{ key: "item",     label: "What to assemble?",   options: ["TV stand / entertainment center", "Desk / workstation", "Shelving unit", "Exercise equipment"] }, { key: "complexity", label: "Complexity", options: ["Simple (< 30 min)", "Medium (30–90 min)", "Complex (2+ hrs)"] }] },
  ],
};

const CATEGORIES = Object.keys(TASKS);

// Line icons, mirroring the mobile app's outlined-icon set (see
// apps/mobile-flutter/lib/service_catalog.dart) so a category looks the same on
// web and in the app.
const CATEGORY_META: Record<string, { icon: LucideIcon; color: string }> = {
  Plumbing:          { icon: Droplet,      color: "#38BDF8" },
  Electrical:        { icon: Zap,          color: "#F59E0B" },
  HVAC:              { icon: Snowflake,    color: "#7DD3FC" },
  Carpentry:         { icon: Hammer,       color: "#D97706" },
  Painting:          { icon: Paintbrush,   color: "#A78BFA" },
  Roofing:           { icon: Home,         color: "#94A3B8" },
  Cleaning:          { icon: Sparkles,     color: "#34D399" },
  Landscaping:       { icon: Leaf,         color: "#4ADE80" },
  "Appliance Repair":{ icon: Refrigerator, color: "#818CF8" },
  Moving:            { icon: Truck,        color: "#FB923C" },
  General:           { icon: Wrench,       color: "#64748B" },
};

const CATEGORY_API: Record<string, string> = {
  Plumbing: "PLUMBING", Electrical: "ELECTRICAL", HVAC: "HVAC",
  Carpentry: "CARPENTRY", Painting: "PAINTING", Roofing: "ROOFING",
  Cleaning: "CLEANING", Landscaping: "LANDSCAPING", "Appliance Repair": "APPLIANCE_REPAIR",
  Moving: "MOVING", General: "GENERAL",
};

export default function InstantQuoteSection() {
  const [category, setCategory] = useState<string | null>(null);
  const [task,     setTask]     = useState<Task | null>(null);
  const [details,  setDetails]  = useState<Record<string, string>>({});
  const [loading,  setLoading]  = useState(false);
  const [quote,    setQuote]    = useState<Quote | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  const selectCategory = (c: string) => { setCategory(c); setTask(null); setDetails({}); setQuote(null); setError(null); };
  const selectTask     = (t: Task)   => { setTask(t);     setDetails({}); setQuote(null); setError(null); };
  const setDetail      = (key: string, val: string) => setDetails(prev => ({ ...prev, [key]: val }));

  const allDetailsFilled = task ? task.details.every(d => details[d.key]) : false;
  const canQuote         = task && (task.details.length === 0 || allDetailsFilled);

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

  const reset = () => { setCategory(null); setTask(null); setDetails({}); setQuote(null); setError(null); };

  const activeMeta = category ? CATEGORY_META[category] : null;

  const [spin, setSpin] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSpin(s => (s + 1) % POPULAR.length), 2200);
    return () => clearInterval(id);
  }, []);

  const popular     = POPULAR[spin];
  const PopularIcon = CATEGORY_META[popular.cat].icon;

  return (
    <section className="relative mx-4 sm:mx-6 lg:mx-auto max-w-7xl my-8 rounded-3xl bg-gray-950 overflow-hidden py-4 sm:py-6">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-400/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section heading */}
        <div className="text-center mb-3">
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
            className="text-3xl font-extrabold text-white mb-2"
          >
            Get an Instant Quote
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.14 }}
            className="text-gray-400 text-base max-w-xl mx-auto"
          >
            Tell us what you need — we'll give you a price range before you book. No consultations, no hidden fees.
          </motion.p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-stretch">

          {/* ── Left: illustration ── */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center lg:h-full"
          >
            <motion.img
              src="/instant-quote.png?v=1"
              alt="Get an instant quote in seconds"
              className="w-full h-auto lg:h-full lg:w-auto lg:max-w-full object-contain"
              animate={{ y: [0, -14, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>

          {/* ── Right: quote result + service picker (stacked) ── */}
          <div className="flex flex-col gap-6">

          {/* ── Choose a service (configurator) ── */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="order-1 bg-white/5 border border-white/10 rounded-3xl p-4 space-y-4"
          >

            {/* Step 1 — Category grid */}
            <div>
              <p className="text-white text-sm font-bold mb-3 text-center">
                Choose a service
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {CATEGORIES.map(c => {
                  const meta   = CATEGORY_META[c];
                  const CatIcon = meta.icon;
                  const active = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => selectCategory(c)}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl border transition-all duration-150 text-center"
                      style={{
                        backgroundColor: active ? `${meta.color}14` : "rgba(255,255,255,0.04)",
                        borderColor:     active ? `${meta.color}50` : "rgba(255,255,255,0.08)",
                      }}
                    >
                      <CatIcon
                        className="w-5 h-5"
                        strokeWidth={1.75}
                        style={{ color: active ? meta.color : "rgba(255,255,255,0.65)" }}
                      />
                      <span className="text-xs font-semibold leading-tight" style={{ color: active ? meta.color : "rgba(255,255,255,0.55)" }}>
                        {c}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2 — Task */}
            <AnimatePresence>
              {category && (
                <motion.div
                  key="task-step"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-white text-sm font-bold mb-3">
                    What specifically?
                  </p>
                  <div className="space-y-1.5">
                    {TASKS[category].map(t => {
                      const active = task?.label === t.label;
                      return (
                        <button
                          key={t.label}
                          type="button"
                          onClick={() => selectTask(t)}
                          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-all duration-150 text-left"
                          style={{
                            backgroundColor: active ? (activeMeta ? `${activeMeta.color}14` : "rgba(249,115,22,0.12)") : "rgba(255,255,255,0.04)",
                            borderColor:     active ? (activeMeta ? `${activeMeta.color}40` : "rgba(249,115,22,0.4)") : "rgba(255,255,255,0.08)",
                            color:           active ? (activeMeta?.color ?? "#F97316") : "rgba(255,255,255,0.7)",
                          }}
                        >
                          {t.label}
                          <ChevronRight className="w-4 h-4 opacity-40 flex-shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step 3 — Details */}
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
                  <p className="text-white text-sm font-bold">
                    A few details
                  </p>
                  {task.details.map(d => (
                    <div key={d.key}>
                      <label className="text-gray-400 text-xs font-semibold mb-2 block">{d.label}</label>
                      <div className="flex flex-wrap gap-2">
                        {d.options.map(opt => {
                          const sel = details[d.key] === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setDetail(d.key, opt)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150"
                              style={{
                                backgroundColor: sel ? (activeMeta ? `${activeMeta.color}18` : "rgba(249,115,22,0.15)") : "rgba(255,255,255,0.04)",
                                borderColor:     sel ? (activeMeta ? `${activeMeta.color}50` : "rgba(249,115,22,0.5)") : "rgba(255,255,255,0.1)",
                                color:           sel ? (activeMeta?.color ?? "#F97316") : "rgba(255,255,255,0.5)",
                              }}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Get Quote CTA */}
            <AnimatePresence>
              {task && (
                <motion.div key="cta" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <button
                    type="button"
                    onClick={getQuote}
                    disabled={loading || !canQuote}
                    className="w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "linear-gradient(135deg, #F97316 0%, #FB923C 100%)", color: "#fff" }}
                  >
                    {loading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Calculating…</span></>
                      : <><Zap className="w-4 h-4" /><span>Get My Instant Quote</span></>
                    }
                  </button>
                  {task.details.length > 0 && !allDetailsFilled && (
                    <p className="text-gray-600 text-xs text-center mt-2">Fill in the details above to get your quote</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>

          {/* ── Your quote appears here (result) ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="order-2"
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

              {/* Loading */}
              {loading && !quote && (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-4 py-20"
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
                  className="rounded-3xl overflow-hidden border border-white/10"
                >
                  {/* Header band */}
                  <div className="bg-white/5 border-b border-white/8 px-7 py-5 flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Your Estimate</p>
                      <p className="text-white font-bold text-base">{task?.label}</p>
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${
                      quote.confidence === "guaranteed"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-amber-500/15 text-amber-400"
                    }`}>
                      <BadgeCheck className="w-3.5 h-3.5" />
                      {quote.confidence === "guaranteed" ? "Guaranteed" : "Estimate"}
                    </span>
                  </div>

                  <div className="bg-[#080F1A] px-7 py-6 space-y-6">
                    {/* Price */}
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}>
                      <div className="flex items-start gap-1">
                        <span className="text-orange-400 text-2xl font-black mt-2">$</span>
                        <span className="text-7xl font-black text-white leading-none">{quote.minPrice}</span>
                        <span className="text-3xl text-gray-600 font-bold mt-4 mx-1">–</span>
                        <span className="text-3xl text-gray-400 font-black mt-4">${quote.maxPrice}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 text-gray-500 text-sm">
                        <Clock className="w-4 h-4" />{quote.duration}
                      </div>
                    </motion.div>

                    <div className="h-px bg-white/6" />

                    {/* Includes */}
                    <div className="space-y-3">
                      <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">What's included</p>
                      {quote.includes.map((item, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.08 }}
                          className="flex items-center gap-3"
                        >
                          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <span className="text-gray-300 text-sm">{item}</span>
                        </motion.div>
                      ))}
                    </div>

                    {/* Note */}
                    {quote.note && (
                      <div className="bg-orange-500/8 border border-orange-500/18 rounded-xl px-4 py-3">
                        <p className="text-orange-300 text-xs leading-relaxed">
                          <span className="font-bold">Note: </span>{quote.note}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                      <Link
                        href="/register"
                        className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl transition-colors text-sm"
                      >
                        Book at This Price <ArrowRight className="w-4 h-4" />
                      </Link>
                      <button type="button" onClick={reset}
                        className="px-4 py-3 bg-white/5 border border-white/10 text-gray-400 text-sm rounded-xl hover:bg-white/10 hover:text-white transition-colors"
                        title="Start over"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Placeholder */}
              {!quote && !loading && !error && (
                <motion.div key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="border-2 border-dashed border-white/8 rounded-3xl p-4 flex flex-col items-center justify-center gap-3 text-center min-h-[90px]"
                >
                  <div className="w-12 h-12 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-center justify-center">
                    <Zap className="w-6 h-6 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-base">Your quote appears here</p>
                    <p className="text-gray-500 text-xs mt-1 max-w-xs leading-relaxed">
                      Pick a service above to get a real price in seconds
                    </p>
                  </div>
                  {/* Rotating popular request */}
                  <div className="w-full" style={{ perspective: "700px" }}>
                    <p className="text-gray-600 text-xs font-semibold uppercase tracking-wider mb-2">Popular requests</p>
                    <AnimatePresence mode="wait">
                      <motion.button
                        key={spin}
                        type="button"
                        initial={{ rotateX: -90, opacity: 0 }}
                        animate={{ rotateX: 0, opacity: 1 }}
                        exit={{ rotateX: 90, opacity: 0 }}
                        transition={{ duration: 0.4, ease: "easeInOut" }}
                        style={{ transformStyle: "preserve-3d" }}
                        onClick={() => {
                          const { cat, label } = popular;
                          selectCategory(cat);
                          const found = TASKS[cat].find(t => t.label === label || label.startsWith(t.label.split(" ")[0]));
                          if (found) selectTask(found);
                        }}
                        className="w-full text-left flex items-center gap-2 px-3 py-2.5 bg-white/4 border border-white/8 rounded-xl hover:bg-white/8 hover:border-white/15 transition-colors text-sm group"
                      >
                        <PopularIcon className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
                        <span className="text-gray-300 font-medium flex-1">{popular.label}</span>
                        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-orange-400 transition-colors" />
                      </motion.button>
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>

          </div>

        </div>
      </div>
    </section>
  );
}

import { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { C } from "@/constants/colors";

const API = "https://taptarea.com/api";

type Task  = { label: string; details: { key: string; label: string; options: string[] }[] };
type Quote = { minPrice: number; maxPrice: number; duration: string; includes: string[]; note: string; confidence: string };

const TASKS: Record<string, Task[]> = {
  Plumbing: [
    { label: "Fix Leaky Faucet",     details: [{ key: "location", label: "Location",          options: ["Kitchen", "Bathroom", "Outdoor"] }, { key: "parts", label: "Parts supplied by", options: ["Me", "Handyman"] }] },
    { label: "Unclog Drain",         details: [{ key: "drain",    label: "Which drain?",       options: ["Kitchen sink", "Bathroom sink", "Shower / tub", "Toilet"] }] },
    { label: "Replace Water Heater", details: [{ key: "type",     label: "Type",               options: ["Tank (electric)", "Tank (gas)", "Tankless"] }] },
  ],
  Electrical: [
    { label: "Install Ceiling Fan",  details: [{ key: "height",   label: "Ceiling height",     options: ["8 ft", "9 ft", "10+ ft", "Vaulted"] }, { key: "preWired", label: "Pre-wired box?", options: ["Yes", "No — needs wiring"] }, { key: "fan", label: "Fan supplied by", options: ["Me", "Handyman"] }] },
    { label: "Replace Outlet",       details: [{ key: "qty",      label: "How many?",          options: ["1", "2–3", "4+"] }, { key: "type", label: "Type", options: ["Standard", "GFCI", "USB combo"] }] },
    { label: "Install Light Fixture",details: [{ key: "qty",      label: "How many?",          options: ["1", "2–3", "4+"] }] },
  ],
  Carpentry: [
    { label: "Assemble Furniture",   details: [{ key: "pieces",   label: "Number of pieces",   options: ["1", "2–3", "4+"] }, { key: "size", label: "Largest piece", options: ["Small", "Medium", "Large"] }] },
    { label: "Install Shelving",     details: [{ key: "shelves",  label: "Number of shelves",  options: ["1–2", "3–5", "6+"] }] },
  ],
  Painting: [
    { label: "Paint a Room",         details: [{ key: "size",     label: "Room size",          options: ["Small", "Medium", "Large"] }, { key: "coats", label: "Coats", options: ["1 coat", "2 coats"] }] },
    { label: "Patch & Paint Wall",   details: [{ key: "patches",  label: "Damage level",       options: ["1–2 small holes", "3–5 holes", "Large area"] }] },
  ],
  Cleaning: [
    { label: "Deep Clean",           details: [{ key: "beds",     label: "Bedrooms",           options: ["Studio / 1BR", "2BR", "3BR", "4BR+"] }, { key: "baths", label: "Bathrooms", options: ["1", "2", "3+"] }] },
    { label: "Move-Out Clean",       details: [{ key: "beds",     label: "Bedrooms",           options: ["Studio / 1BR", "2BR", "3BR", "4BR+"] }] },
  ],
  Moving: [
    { label: "Local Move",           details: [{ key: "size",     label: "Home size",          options: ["Studio / 1BR", "2BR", "3BR", "4BR+"] }, { key: "distance", label: "Distance", options: ["< 5 miles", "5–15 miles", "15–30 miles", "30+ miles"] }] },
  ],
  General: [
    { label: "TV Mounting",          details: [{ key: "tvSize",   label: "TV size",            options: ['Under 40"', '40–55"', '55–75"', '75"+'] }, { key: "wall", label: "Wall type", options: ["Drywall", "Concrete / brick", "Tile"] }] },
    { label: "Picture Hanging",      details: [{ key: "qty",      label: "How many items?",    options: ["1–2", "3–5", "6+"] }] },
    { label: "Assembly & Mounting",  details: [{ key: "item",     label: "What to assemble?",  options: ["TV stand", "Desk", "Shelving unit", "Exercise equipment"] }] },
  ],
};

const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  Plumbing:   { icon: "🔧", color: "#38BDF8" },
  Electrical: { icon: "⚡", color: "#F59E0B" },
  Carpentry:  { icon: "🪵", color: "#D97706" },
  Painting:   { icon: "🎨", color: "#A78BFA" },
  Cleaning:   { icon: "✨", color: "#34D399" },
  Moving:     { icon: "📦", color: "#FB923C" },
  General:    { icon: "🛠️", color: "#94A3B8" },
};

const CATEGORY_API: Record<string, string> = {
  Plumbing: "PLUMBING", Electrical: "ELECTRICAL", Carpentry: "CARPENTRY",
  Painting: "PAINTING", Cleaning: "CLEANING", Moving: "MOVING", General: "GENERAL",
};

const CATEGORIES = Object.keys(TASKS);

function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  const bg = done ? C.emerald : active ? C.sky : "rgba(255,255,255,0.08)";
  const tc = done || active ? C.ink : "rgba(255,255,255,0.3)";
  return (
    <View style={[sd.dot, { backgroundColor: bg }]}>
      <Text style={[sd.dotText, { color: tc }]}>{done ? "✓" : n}</Text>
    </View>
  );
}
const sd = StyleSheet.create({
  dot:     { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  dotText: { fontSize: 12, fontWeight: "900" },
});

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, selected && s.chipOn]} activeOpacity={0.75}>
      <Text style={[s.chipText, selected && s.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function InstantQuoteScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<string | null>(null);
  const [task,     setTask]     = useState<Task | null>(null);
  const [details,  setDetails]  = useState<Record<string, string>>({});
  const [loading,  setLoading]  = useState(false);
  const [quote,    setQuote]    = useState<Quote | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  const quoteFade = useRef(new Animated.Value(0)).current;
  const btnPulse  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(btnPulse, { toValue: 0.96, duration: 700, useNativeDriver: true }),
          Animated.timing(btnPulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      btnPulse.setValue(1);
    }
  }, [loading]);

  useEffect(() => {
    if (quote) {
      quoteFade.setValue(0);
      Animated.timing(quoteFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, [quote]);

  const selectCategory = (c: string) => { setCategory(c); setTask(null); setDetails({}); setQuote(null); setError(null); };
  const selectTask     = (t: Task)   => { setTask(t);     setDetails({}); setQuote(null); setError(null); };
  const setDetail      = (k: string, v: string) => setDetails(p => ({ ...p, [k]: v }));

  const allFilled = task ? task.details.every(d => details[d.key]) : false;
  const canQuote  = !!task && (task.details.length === 0 || allFilled);

  const currentStep = !category ? 1 : !task ? 2 : !allFilled && task.details.length > 0 ? 3 : 3;

  const getQuote = async () => {
    if (!category || !task) return;
    setLoading(true);
    setQuote(null);
    setError(null);
    try {
      const res = await fetch(`${API}/ai/instant-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: CATEGORY_API[category], task: task.label, details }),
      });
      const data = await res.json();
      if (res.ok) setQuote(data);
      else setError(data.error || "Could not generate quote. Try again.");
    } catch (e: any) {
      setError(e?.message || "Network error. Check your connection.");
    }
    setLoading(false);
  };

  const catMeta = category ? CATEGORY_META[category] : null;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Nav */}
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={s.headerRow}>
          <View style={s.headerIcon}><Text style={{ fontSize: 28 }}>💰</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.heading}>Instant Quote</Text>
            <Text style={s.sub}>Get a real price before you book — no surprises.</Text>
          </View>
        </View>

        {/* Progress stepper */}
        <View style={s.stepper}>
          {[
            { n: 1, label: "Service",  done: !!category },
            { n: 2, label: "Task",     done: !!task },
            { n: 3, label: "Details",  done: allFilled && task !== null },
          ].map((step, i) => (
            <View key={step.n} style={s.stepItem}>
              <StepDot n={step.n} active={currentStep === step.n} done={step.done} />
              <Text style={[s.stepLabel, (step.done || currentStep === step.n) && s.stepLabelActive]}>
                {step.label}
              </Text>
              {i < 2 && <View style={[s.stepLine, step.done && s.stepLineDone]} />}
            </View>
          ))}
        </View>

        {/* Step 1 — Category grid */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>1  Choose a service</Text>
          <View style={s.catGrid}>
            {CATEGORIES.map(c => {
              const meta = CATEGORY_META[c];
              const active = category === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[s.catCard, active && { borderColor: meta.color, backgroundColor: meta.color + "14" }]}
                  onPress={() => selectCategory(c)}
                  activeOpacity={0.75}
                >
                  <View style={[s.catIconCircle, { backgroundColor: meta.color + "1A" }]}>
                    <Text style={{ fontSize: 22 }}>{meta.icon}</Text>
                  </View>
                  <Text style={[s.catCardLabel, active && { color: meta.color }]}>{c}</Text>
                  {active && <View style={[s.catCheck, { backgroundColor: meta.color }]}><Text style={s.catCheckText}>✓</Text></View>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Step 2 — Task */}
        {category && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>2  What specifically?</Text>
            <View style={s.taskList}>
              {TASKS[category].map(t => {
                const active = task?.label === t.label;
                return (
                  <TouchableOpacity
                    key={t.label}
                    style={[s.taskCard, active && s.taskCardOn]}
                    onPress={() => selectTask(t)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.taskLabel, active && s.taskLabelOn]}>{t.label}</Text>
                    <Text style={[s.taskArrow, active && { color: C.ink }]}>›</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Step 3 — Details */}
        {task && task.details.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>3  A few quick details</Text>
            {task.details.map(d => (
              <View key={d.key} style={s.detailBlock}>
                <Text style={s.detailLabel}>{d.label}</Text>
                <View style={s.chipRow}>
                  {d.options.map(opt => (
                    <Chip key={opt} label={opt} selected={details[d.key] === opt} onPress={() => setDetail(d.key, opt)} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Quote button */}
        {task && (
          <Animated.View style={{ transform: [{ scale: btnPulse }] }}>
            <TouchableOpacity
              style={[s.quoteBtn, !canQuote && s.quoteBtnOff]}
              onPress={getQuote}
              disabled={loading || !canQuote}
              activeOpacity={0.85}
            >
              {loading ? (
                <Text style={s.quoteBtnText}>Calculating your price…</Text>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 18 }}>⚡</Text>
                  <Text style={s.quoteBtnText}>Get My Instant Quote</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Error */}
        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>⚠️  {error}</Text>
          </View>
        )}

        {/* Quote result */}
        {quote && (
          <Animated.View style={[s.quoteCard, { opacity: quoteFade }]}>

            {/* Header band */}
            <View style={s.quoteBand}>
              <View>
                <Text style={s.quoteBandLabel}>Your Estimate</Text>
                <Text style={s.quoteBandTask}>{task?.label}</Text>
              </View>
              <View style={[
                s.confBadge,
                { backgroundColor: quote.confidence === "guaranteed" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.12)" },
              ]}>
                <Text style={[s.confText, { color: quote.confidence === "guaranteed" ? C.emerald : C.amber }]}>
                  {quote.confidence === "guaranteed" ? "✓ Guaranteed" : "~ Estimate"}
                </Text>
              </View>
            </View>

            <View style={s.quoteBody}>
              {/* Price */}
              <View style={s.priceRow}>
                <Text style={s.priceDollar}>$</Text>
                <Text style={s.priceMain}>{quote.minPrice}–{quote.maxPrice}</Text>
              </View>
              <View style={s.durationRow}>
                <Text style={s.durationDot}>⏱</Text>
                <Text style={s.durationText}>{quote.duration}</Text>
              </View>

              <View style={s.quoteSep} />

              {/* Includes */}
              <Text style={s.includesTitle}>What's included</Text>
              {quote.includes.map((item, i) => (
                <View key={i} style={s.includeRow}>
                  <View style={s.checkCircle}><Text style={s.checkMark}>✓</Text></View>
                  <Text style={s.includeText}>{item}</Text>
                </View>
              ))}

              {/* Note */}
              {!!quote.note && (
                <View style={s.noteBox}>
                  <Text style={s.noteText}>📋  {quote.note}</Text>
                </View>
              )}

              {/* Book */}
              <TouchableOpacity
                style={s.bookBtn}
                onPress={() => router.push({ pathname: "/(auth)/register" as any, params: { role: "CUSTOMER" } })}
                activeOpacity={0.85}
              >
                <Text style={s.bookBtnText}>Sign Up & Lock This Price  →</Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.ink },
  scroll:        { padding: 20 },
  back:          { marginBottom: 22 },
  backText:      { color: C.sky, fontSize: 15, fontWeight: "600" },

  headerRow:     { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 28 },
  headerIcon:    { width: 56, height: 56, borderRadius: 18, backgroundColor: "rgba(56,189,248,0.08)", borderWidth: 1, borderColor: "rgba(56,189,248,0.2)", alignItems: "center", justifyContent: "center" },
  heading:       { color: "#fff", fontSize: 24, fontWeight: "900" },
  sub:           { color: "rgba(255,255,255,0.38)", fontSize: 13, marginTop: 3 },

  // Stepper
  stepper:       { flexDirection: "row", alignItems: "center", marginBottom: 28, paddingHorizontal: 4 },
  stepItem:      { flexDirection: "row", alignItems: "center", flex: 1 },
  stepLabel:     { color: "rgba(255,255,255,0.28)", fontSize: 11, fontWeight: "700", marginLeft: 6 },
  stepLabelActive:{ color: "rgba(255,255,255,0.7)" },
  stepLine:      { flex: 1, height: 1.5, backgroundColor: "rgba(255,255,255,0.08)", marginHorizontal: 6 },
  stepLineDone:  { backgroundColor: C.emerald + "60" },

  // Section
  section:       { marginBottom: 24 },
  sectionTitle:  { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 14 },

  // Category grid
  catGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  catCard:       { width: "47%", backgroundColor: "#1E293B", borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.07)", alignItems: "center", gap: 8 },
  catIconCircle: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  catCardLabel:  { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "700" },
  catCheck:      { position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  catCheckText:  { color: "#0F172A", fontSize: 10, fontWeight: "900" },

  // Task list
  taskList:      { gap: 8 },
  taskCard:      { flexDirection: "row", alignItems: "center", backgroundColor: "#1E293B", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.07)" },
  taskCardOn:    { backgroundColor: C.sky, borderColor: C.sky },
  taskLabel:     { flex: 1, color: "rgba(255,255,255,0.75)", fontSize: 14, fontWeight: "600" },
  taskLabelOn:   { color: C.ink, fontWeight: "800" },
  taskArrow:     { color: "rgba(255,255,255,0.3)", fontSize: 20, fontWeight: "300" },

  // Detail chips
  detailBlock:   { marginBottom: 16 },
  detailLabel:   { color: "rgba(255,255,255,0.38)", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  chipRow:       { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:          { backgroundColor: "#1E293B", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)" },
  chipOn:        { backgroundColor: C.sky, borderColor: C.sky },
  chipText:      { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "600" },
  chipTextOn:    { color: C.ink, fontWeight: "800" },

  // Get Quote button
  quoteBtn:      { backgroundColor: C.sky, borderRadius: 16, paddingVertical: 18, alignItems: "center", marginBottom: 20 },
  quoteBtnOff:   { opacity: 0.3 },
  quoteBtnText:  { color: C.ink, fontWeight: "900", fontSize: 16, letterSpacing: 0.3 },

  // Error
  errorBox:      { backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "rgba(239,68,68,0.25)" },
  errorText:     { color: "#EF4444", fontSize: 13, lineHeight: 20 },

  // Quote card
  quoteCard:     { borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  quoteBand:     { backgroundColor: "#1E293B", padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  quoteBandLabel:{ color: "rgba(255,255,255,0.38)", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 },
  quoteBandTask: { color: "#fff", fontSize: 16, fontWeight: "800" },
  confBadge:     { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  confText:      { fontSize: 12, fontWeight: "700" },

  quoteBody:     { backgroundColor: "#0F1C2E", padding: 20, gap: 14 },

  priceRow:      { flexDirection: "row", alignItems: "flex-start" },
  priceDollar:   { color: C.sky, fontSize: 28, fontWeight: "900", marginTop: 8, marginRight: 2 },
  priceMain:     { color: "#fff", fontSize: 56, fontWeight: "900", lineHeight: 60 },

  durationRow:   { flexDirection: "row", alignItems: "center", gap: 6 },
  durationDot:   { fontSize: 14 },
  durationText:  { color: "rgba(255,255,255,0.45)", fontSize: 14 },

  quoteSep:      { height: 1, backgroundColor: "rgba(255,255,255,0.07)" },

  includesTitle: { color: "rgba(255,255,255,0.32)", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.4 },
  includeRow:    { flexDirection: "row", alignItems: "center", gap: 10 },
  checkCircle:   { width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(16,185,129,0.2)", alignItems: "center", justifyContent: "center" },
  checkMark:     { color: C.emerald, fontSize: 11, fontWeight: "900" },
  includeText:   { color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 20, flex: 1 },

  noteBox:       { backgroundColor: "rgba(249,115,22,0.08)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(249,115,22,0.2)" },
  noteText:      { color: "#FB923C", fontSize: 12, lineHeight: 19 },

  bookBtn:       { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  bookBtnText:   { color: C.ink, fontWeight: "900", fontSize: 15, letterSpacing: 0.3 },
});

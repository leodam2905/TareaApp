import { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { C } from "@/constants/colors";

const API = "https://taptarea.com/api";

type Task   = { label: string; details: { key: string; label: string; options: string[] }[] };
type Quote  = { minPrice: number; maxPrice: number; duration: string; includes: string[]; note: string; confidence: string };

const TASKS: Record<string, Task[]> = {
  Plumbing: [
    { label: "Fix Leaky Faucet",    details: [{ key: "location", label: "Location",          options: ["Kitchen", "Bathroom", "Outdoor"] }, { key: "parts", label: "Parts supplied by", options: ["Me", "Handyman"] }] },
    { label: "Unclog Drain",        details: [{ key: "drain",    label: "Which drain?",       options: ["Kitchen sink", "Bathroom sink", "Shower / tub", "Toilet"] }] },
    { label: "Replace Water Heater",details: [{ key: "type",     label: "Type",               options: ["Tank (electric)", "Tank (gas)", "Tankless"] }] },
  ],
  Electrical: [
    { label: "Install Ceiling Fan", details: [{ key: "height",   label: "Ceiling height",     options: ["8 ft", "9 ft", "10+ ft", "Vaulted"] }, { key: "preWired", label: "Pre-wired box?", options: ["Yes", "No — needs wiring"] }, { key: "fan", label: "Fan supplied by", options: ["Me", "Handyman"] }] },
    { label: "Replace Outlet",      details: [{ key: "qty",      label: "How many?",          options: ["1", "2–3", "4+"] }, { key: "type", label: "Type", options: ["Standard", "GFCI", "USB combo"] }] },
    { label: "Install Light Fixture",details: [{ key: "qty",     label: "How many?",          options: ["1", "2–3", "4+"] }] },
  ],
  Carpentry: [
    { label: "Assemble Furniture",  details: [{ key: "pieces",   label: "Number of pieces",   options: ["1", "2–3", "4+"] }, { key: "size", label: "Largest piece", options: ["Small", "Medium", "Large"] }] },
    { label: "Install Shelving",    details: [{ key: "shelves",  label: "Number of shelves",  options: ["1–2", "3–5", "6+"] }] },
  ],
  Painting: [
    { label: "Paint a Room",        details: [{ key: "size",     label: "Room size",          options: ["Small", "Medium", "Large"] }, { key: "coats", label: "Coats", options: ["1 coat", "2 coats"] }] },
    { label: "Patch & Paint Wall",  details: [{ key: "patches",  label: "Damage level",       options: ["1–2 small holes", "3–5 holes", "Large area"] }] },
  ],
  Cleaning: [
    { label: "Deep Clean",          details: [{ key: "beds",     label: "Bedrooms",           options: ["Studio / 1BR", "2BR", "3BR", "4BR+"] }, { key: "baths", label: "Bathrooms", options: ["1", "2", "3+"] }] },
    { label: "Move-Out Clean",      details: [{ key: "beds",     label: "Bedrooms",           options: ["Studio / 1BR", "2BR", "3BR", "4BR+"] }] },
  ],
  Moving: [
    { label: "Local Move",          details: [{ key: "size",     label: "Home size",          options: ["Studio / 1BR", "2BR", "3BR", "4BR+"] }, { key: "distance", label: "Distance", options: ["< 5 miles", "5–15 miles", "15–30 miles", "30+ miles"] }] },
  ],
  General: [
    { label: "TV Mounting",         details: [{ key: "tvSize",   label: "TV size",            options: ['Under 40"', '40–55"', '55–75"', '75"+'] }, { key: "wall", label: "Wall type", options: ["Drywall", "Concrete / brick", "Tile"] }] },
    { label: "Picture Hanging",     details: [{ key: "qty",      label: "How many items?",    options: ["1–2", "3–5", "6+"] }] },
    { label: "Assembly & Mounting", details: [{ key: "item",     label: "What to assemble?",  options: ["TV stand", "Desk", "Shelving unit", "Exercise equipment"] }] },
  ],
};

const CATEGORIES = Object.keys(TASKS);
const CATEGORY_API: Record<string, string> = {
  Plumbing: "PLUMBING", Electrical: "ELECTRICAL", Carpentry: "CARPENTRY",
  Painting: "PAINTING", Cleaning: "CLEANING", Moving: "MOVING", General: "GENERAL",
};

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[s.chip, selected && s.chipActive]}
    >
      <Text style={[s.chipText, selected && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function InstantQuoteScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<string | null>(null);
  const [task, setTask]         = useState<Task | null>(null);
  const [details, setDetails]   = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(false);
  const [quote, setQuote]       = useState<Quote | null>(null);

  const selectCategory = (c: string) => { setCategory(c); setTask(null); setDetails({}); setQuote(null); };
  const selectTask = (t: Task) => { setTask(t); setDetails({}); setQuote(null); };
  const setDetail = (key: string, val: string) => setDetails(prev => ({ ...prev, [key]: val }));

  const allFilled = task ? task.details.every(d => details[d.key]) : false;
  const canQuote  = task && (task.details.length === 0 || allFilled);

  const getQuote = async () => {
    if (!category || !task) return;
    setLoading(true);
    setQuote(null);
    try {
      const res = await fetch(`${API}/ai/instant-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: CATEGORY_API[category], task: task.label, details }),
      });
      const data = await res.json();
      if (res.ok) setQuote(data);
    } catch {
      // fail silently, button stays
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.heading}>Instant Quote</Text>
        <Text style={s.sub}>Select a service and task to get a guaranteed price before you book.</Text>

        {/* Step 1 */}
        <Text style={s.stepLabel}>1. Choose a service</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          {CATEGORIES.map(c => <Chip key={c} label={c} selected={category === c} onPress={() => selectCategory(c)} />)}
        </ScrollView>

        {/* Step 2 */}
        {category && (
          <>
            <Text style={s.stepLabel}>2. What specifically?</Text>
            <View style={s.chipWrap}>
              {TASKS[category].map(t => <Chip key={t.label} label={t.label} selected={task?.label === t.label} onPress={() => selectTask(t)} />)}
            </View>
          </>
        )}

        {/* Step 3 */}
        {task && task.details.length > 0 && (
          <>
            <Text style={s.stepLabel}>3. A few details</Text>
            {task.details.map(d => (
              <View key={d.key} style={{ marginBottom: 16 }}>
                <Text style={s.detailLabel}>{d.label}</Text>
                <View style={s.chipWrap}>
                  {d.options.map(opt => (
                    <Chip key={opt} label={opt} selected={details[d.key] === opt} onPress={() => setDetail(d.key, opt)} />
                  ))}
                </View>
              </View>
            ))}
          </>
        )}

        {/* Quote button */}
        {task && (
          <TouchableOpacity
            style={[s.btn, !canQuote && s.btnDisabled]}
            onPress={getQuote}
            disabled={loading || !canQuote}
          >
            {loading
              ? <ActivityIndicator color={C.ink} />
              : <Text style={s.btnText}>⚡  Get My Instant Quote</Text>
            }
          </TouchableOpacity>
        )}

        {/* Result */}
        {quote && (
          <View style={s.quoteCard}>
            <View style={s.quoteBadgeRow}>
              <Text style={s.quoteLabel}>Your Quote</Text>
              <View style={[s.confidenceBadge, { backgroundColor: quote.confidence === "guaranteed" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)" }]}>
                <Text style={[s.confidenceText, { color: quote.confidence === "guaranteed" ? "#10B981" : "#F59E0B" }]}>
                  {quote.confidence === "guaranteed" ? "✓ Price Guaranteed" : "~ Estimate"}
                </Text>
              </View>
            </View>

            <Text style={s.priceRange}>
              <Text style={s.priceMain}>${quote.minPrice}–${quote.maxPrice}</Text>
            </Text>
            <Text style={s.duration}>⏱ {quote.duration}</Text>

            <Text style={s.includesLabel}>What's included</Text>
            {quote.includes.map((item, i) => (
              <Text key={i} style={s.includeItem}>• {item}</Text>
            ))}

            {quote.note ? (
              <View style={s.noteBox}>
                <Text style={s.noteText}>Note: {quote.note}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={s.bookBtn}
              onPress={() => router.push({ pathname: "/(auth)/register" as any, params: { role: "CUSTOMER" } })}
            >
              <Text style={s.bookBtnText}>Sign Up & Book at This Price →</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: C.ink },
  scroll:           { padding: 20 },
  back:             { marginBottom: 16 },
  backText:         { color: C.sky, fontSize: 15, fontWeight: "600" },
  heading:          { color: "#fff", fontSize: 28, fontWeight: "900", marginBottom: 6 },
  sub:              { color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 20, marginBottom: 28 },
  stepLabel:        { color: "#fff", fontSize: 14, fontWeight: "800", marginBottom: 12 },
  chip:             { backgroundColor: "#1E293B", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  chipActive:       { backgroundColor: C.sky, borderColor: C.sky },
  chipText:         { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "600" },
  chipTextActive:   { color: C.ink },
  chipWrap:         { flexDirection: "row", flexWrap: "wrap", marginBottom: 20 },
  detailLabel:      { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  btn:              { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginBottom: 28 },
  btnDisabled:      { opacity: 0.35 },
  btnText:          { color: C.ink, fontWeight: "900", fontSize: 16 },
  quoteCard:        { backgroundColor: "#1E293B", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "rgba(56,189,248,0.25)", gap: 12 },
  quoteBadgeRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  quoteLabel:       { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  confidenceBadge:  { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  confidenceText:   { fontSize: 12, fontWeight: "700" },
  priceRange:       { marginVertical: 4 },
  priceMain:        { color: "#fff", fontSize: 40, fontWeight: "900" },
  duration:         { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  includesLabel:    { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginTop: 4 },
  includeItem:      { color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 22 },
  noteBox:          { backgroundColor: "rgba(249,115,22,0.1)", borderRadius: 10, padding: 12 },
  noteText:         { color: "#FB923C", fontSize: 12, lineHeight: 18 },
  bookBtn:          { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  bookBtnText:      { color: C.ink, fontWeight: "900", fontSize: 15 },
});

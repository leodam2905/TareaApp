import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Switch
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { api, API_BASE } from "@/lib/api";
import { getToken } from "@/lib/storage";
import DateTimePicker from "@react-native-community/datetimepicker";

const BLUE = "#2563EB", INK = "#0F172A", MUTED = "#64748B", SURFACE = "#F1F5F9", LINE = "#E2E8F0";

const CATEGORIES = [
  { value: "PLUMBING",        label: "Plumbing",   emoji: "🚰" },
  { value: "ELECTRICAL",      label: "Electrical", emoji: "💡" },
  { value: "PAINTING",        label: "Painting",   emoji: "🎨" },
  { value: "CARPENTRY",       label: "Assembly",   emoji: "🛠️" },
  { value: "CLEANING",        label: "Cleaning",   emoji: "🧹" },
  { value: "HVAC",            label: "HVAC",       emoji: "❄️" },
  { value: "ROOFING",         label: "Roofing",    emoji: "🏠" },
  { value: "LANDSCAPING",     label: "Landscaping",emoji: "🌿" },
  { value: "MOVING",          label: "Moving",     emoji: "📦" },
  { value: "APPLIANCE_REPAIR",label: "Appliance",  emoji: "🔌" },
  { value: "LAUNDRY",         label: "Laundry",    emoji: "🧺" },
  { value: "GENERAL",         label: "General",    emoji: "🔧" },
];
const URGENCY = [
  { value: "STANDARD", label: "Standard", desc: "Within a few days",   icon: "time-outline",  color: BLUE },
  { value: "SOON",     label: "Soon",     desc: "Within 24–48 hours",  icon: "time-outline",  color: "#F59E0B" },
  { value: "URGENT",   label: "Urgent",   desc: "As soon as possible", icon: "flash",         color: "#EF4444" },
];
const STEPS = ["Details", "Schedule", "Location", "Review"];
const catLabel = (v: string) => CATEGORIES.find(c => c.value === v)?.label ?? v;

type Estimate = {
  isFixed: boolean; price: number; min: number; max: number;
  workTime: string; minWindow: number; confidence: number; confidenceLabel: string;
  included: string[]; notIncluded: string[];
  breakdown?: { hourlyRate: number; laborHours: string; labor: number; materials: number; travel: number; urgency: number; platform: number; risk: number };
  note: string;
};

export default function PostJobScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; description?: string; budgetMin?: string; budgetMax?: string;
    handymanId?: string; serviceId?: string; serviceMin?: string; serviceMax?: string; proName?: string }>();
  // "Directed" mode: booking a specific pro from Browse. Same flow as Post a Job,
  // but the approved quote goes only to that pro, who accepts or declines.
  const directed = !!params.handymanId;
  const svcMin = Number(params.serviceMin) || 0;
  const svcMax = Number(params.serviceMax) || svcMin;

  const [step, setStep] = useState(1);
  const [category, setCategory]   = useState(params.category ?? "");
  const [catSearch, setCatSearch] = useState("");
  const [description, setDescription] = useState(params.description ?? "");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [urgency, setUrgency]     = useState("STANDARD");
  const [budgetMin, setBudgetMin] = useState(params.budgetMin ?? "");
  const [budgetMax, setBudgetMax] = useState(params.budgetMax ?? "");
  const [notSure, setNotSure]     = useState(false);
  const [dateObj, setDateObj]     = useState<Date | null>(null);
  const [showDate, setShowDate]   = useState(false);
  const [showTime, setShowTime]   = useState(false);
  const [address, setAddress]     = useState("");
  const [unit, setUnit]           = useState("");
  const [city, setCity]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [aiPrice, setAiPrice]       = useState<Estimate | null>(null);
  const [aiLoading, setAiLoading]   = useState(false);
  const [autoSave, setAutoSave]     = useState(false);

  // AI returns a single fixed price (urgency already included by the backend formula).
  const num = (v: string) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
  const effMin = notSure ? 0 : Math.round(num(budgetMin));
  const effMax = notSure ? 0 : Math.round(num(budgetMax));

  const addPhotos = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Photo access", "Please allow photo access to attach pictures."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 5, quality: 0.7 });
    if (result.canceled) return;
    setUploadingPhoto(true);
    const token = await getToken();
    for (const asset of result.assets) {
      setPhotoUris(p => [...p, asset.uri]);
      const form = new FormData();
      form.append("file", { uri: asset.uri, name: "job.jpg", type: "image/jpeg" } as any);
      form.append("folder", "tarea/job-photos");
      try {
        const res = await fetch(`${API_BASE}/api/upload/image`, { method: "POST", body: form, headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { const d = await res.json(); setPhotoUrls(p => [...p, d.url]); }
      } catch { /* photos are optional */ }
    }
    setUploadingPhoto(false);
  };
  const removePhoto = (i: number) => { setPhotoUris(p => p.filter((_, idx) => idx !== i)); setPhotoUrls(p => p.filter((_, idx) => idx !== i)); };

  // AI fixes a fair price at the end (Review step) from the job description.
  const fetchAiPrice = async () => {
    if (!description.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const res = await api.post("/ai/price-estimate", { category, description: description.trim(), city, urgent: urgency === "URGENT" });
      if (res.ok) {
        const d = await res.json();
        if (d.price != null || (d.min != null && d.max != null)) {
          // In directed mode, keep the price within the pro's stated range.
          const clamp = (n: number) => directed && svcMax > 0 ? Math.min(svcMax, Math.max(svcMin, n)) : n;
          const est: Estimate = {
            isFixed: directed ? true : !!d.isFixed,
            price: clamp(Number(d.price ?? d.min)), min: clamp(Number(d.min ?? d.price)), max: clamp(Number(d.max ?? d.price)),
            workTime: d.workTime ?? "", minWindow: Number(d.minWindow ?? 2),
            confidence: Number(d.confidence ?? 70), confidenceLabel: d.confidenceLabel ?? "Medium",
            included: Array.isArray(d.included) ? d.included : [], notIncluded: Array.isArray(d.notIncluded) ? d.notIncluded : [],
            breakdown: d.breakdown, note: d.note ?? "",
          };
          setAiPrice(est);
          if (est.isFixed) { setBudgetMin(String(est.price)); setBudgetMax(String(est.price)); }
          else { setBudgetMin(String(est.min)); setBudgetMax(String(est.max)); }
          setNotSure(false);
        }
      }
    } catch { /* price stays open if AI is unavailable */ }
    setAiLoading(false);
  };
  useEffect(() => { if (step === 4 && !aiPrice && description.trim()) fetchAiPrice(); }, [step]);
  useEffect(() => { setAiPrice(null); }, [urgency]); // re-price if urgency changes

  // Restore a saved draft on open (unless we arrived pre-filled from AI).
  useEffect(() => {
    if (params.category || params.description) return;
    (async () => {
      const raw = await SecureStore.getItemAsync("job_draft");
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        if (d.category) setCategory(d.category); if (d.description) setDescription(d.description);
        if (d.urgency) setUrgency(d.urgency); if (d.address) setAddress(d.address);
        if (d.unit) setUnit(d.unit); if (d.city) setCity(d.city);
        if (d.scheduledAt) setDateObj(new Date(d.scheduledAt)); if (d.autoSave) setAutoSave(true);
      } catch { /* ignore corrupt draft */ }
    })();
  }, []);
  // Auto-save the draft while the toggle is on.
  useEffect(() => {
    if (!autoSave) return;
    const t = setTimeout(() => {
      SecureStore.setItemAsync("job_draft", JSON.stringify({ category, description, urgency, address, unit, city, scheduledAt: dateObj?.toISOString(), autoSave: true })).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [autoSave, category, description, urgency, address, unit, city, dateObj]);

  const saveDraft = async () => {
    await SecureStore.setItemAsync("job_draft", JSON.stringify({ category, description, urgency, budgetMin, budgetMax, notSure, address, unit, city, scheduledAt: dateObj?.toISOString() })).catch(() => {});
    Alert.alert("Draft saved", "Your job draft is saved on this device.");
  };

  const next = () => {
    if (step === 1) {
      if (!category) { Alert.alert("Pick a service", "Choose what you need help with."); return; }
      if (!description.trim()) { Alert.alert("Describe the job", "Add a short description."); return; }
    }
    if (step === 2 && !dateObj) { Alert.alert("Pick a time", "Choose a preferred date and time."); return; }
    if (step === 3 && (!address.trim() || !city.trim())) { Alert.alert("Add the address", "Enter the service address and city."); return; }
    if (step < 4) setStep(step + 1); else submit();
  };
  const back = () => { if (step > 1) setStep(step - 1); else router.back(); };

  const submit = async (proReview = false) => {
    setSubmitting(true);
    try {
      const fullAddress = unit.trim() ? `${address.trim()}, ${unit.trim()}` : address.trim();
      let latitude: number | undefined, longitude: number | undefined;
      try { const g = await Location.geocodeAsync(`${address.trim()}, ${city.trim()}`); if (g[0]) { latitude = g[0].latitude; longitude = g[0].longitude; } } catch {}
      const uLabel = URGENCY.find(u => u.value === urgency)?.label ?? "Standard";
      const parts = [description.trim()];
      if (urgency !== "STANDARD") parts.push(`⏱ Urgency: ${uLabel}`);
      if (aiPrice?.breakdown && !proReview) parts.push(`⏱ Estimated duration: ~${aiPrice.breakdown.laborHours}h`);
      if (proReview) parts.push("📋 Professional review requested — please review the scope and send your quote.");
      const finalDesc = parts.join("\n\n");
      const title = description.trim().split("\n")[0].slice(0, 60) || `${catLabel(category)} service`;

      if (directed) {
        // Directed booking — the quote goes only to the chosen pro, who accepts or declines.
        const res = await api.post("/bookings", {
          serviceId: params.serviceId,
          handymanUserId: params.handymanId,
          scheduledAt: dateObj!.toISOString(),
          address: fullAddress, city,
          notes: finalDesc,
          totalPrice: effMin || svcMin,
        });
        if (res.ok) { setSubmitted(true); SecureStore.deleteItemAsync("job_draft").catch(() => {}); }
        else { const e = await res.json().catch(() => ({})); Alert.alert("Couldn't send request", e.error ?? "Try again."); }
        setSubmitting(false);
        return;
      }

      const res = await api.post("/job-requests", {
        category, title, description: finalDesc, address: fullAddress, city,
        budgetMin: proReview ? 0 : effMin, budgetMax: proReview ? 0 : effMax,
        materialsCost: proReview ? 0 : (aiPrice?.breakdown?.materials ?? 0),
        scheduledAt: dateObj!.toISOString(), imageUrls: photoUrls,
        ...(latitude != null && longitude != null && { latitude, longitude }),
      });
      if (res.ok) { setSubmitted(true); SecureStore.deleteItemAsync("job_draft").catch(() => {}); }
      else { const e = await res.json().catch(() => ({})); Alert.alert("Error", e.error ?? "Failed to post job. Try again."); }
    } catch { Alert.alert("Error", "Network error. Check your connection."); }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.successBox}>
          <View style={s.successCircle}><Ionicons name="checkmark" size={44} color="#fff" /></View>
          <Text style={s.successTitle}>{directed ? "Request Sent!" : "Job Posted!"}</Text>
          <Text style={s.successSub}>{directed
            ? `Your request${params.proName ? ` for ${params.proName}` : ""} was sent. They'll accept or decline shortly — you'll be notified.`
            : "Nearby pros will be notified and can apply. We'll let you know when someone applies."}</Text>
          <TouchableOpacity style={s.cta} onPress={() => router.replace((directed ? "/(customer)/tabs/bookings" : "/(customer)/requests") as any)}>
            <Text style={s.ctaText}>{directed ? "View My Jobs" : "View My Requests"}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const cats = catSearch.trim() ? CATEGORIES.filter(c => c.label.toLowerCase().includes(catSearch.trim().toLowerCase())) : CATEGORIES;

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={back} hitSlop={10}><Ionicons name="chevron-back" size={22} color={INK} /></TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={s.hTitle}>{directed ? `Request ${params.proName || "Pro"}` : "Post a Job"}</Text>
        </View>
        {directed ? <View style={{ width: 60 }} /> : <TouchableOpacity onPress={saveDraft} hitSlop={10}><Text style={s.saveDraft}>Save Draft</Text></TouchableOpacity>}
      </View>
      <Text style={s.hSub}>{directed ? "Tell us what you need — only this pro will see it." : "Tell us what you need and get matched with trusted pros."}</Text>

      {/* Step indicator */}
      <View style={s.steps}>
        {STEPS.map((label, i) => {
          const n = i + 1, done = n < step, active = n === step;
          return (
            <View key={label} style={s.stepItem}>
              <View style={s.stepNodeRow}>
                {i > 0 && <View style={[s.stepLine, n <= step && { backgroundColor: BLUE }]} />}
                <View style={[s.stepNode, (done || active) && s.stepNodeOn]}>
                  {done ? <Ionicons name="checkmark" size={13} color="#fff" /> : <Text style={[s.stepNum, active && { color: "#fff" }]}>{n}</Text>}
                </View>
                {i < STEPS.length - 1 && <View style={[s.stepLine, n < step && { backgroundColor: BLUE }]} />}
              </View>
              <Text style={[s.stepLabel, active && { color: BLUE, fontWeight: "800" }]}>{label}</Text>
            </View>
          );
        })}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">

          {/* ── STEP 1 · DETAILS ── */}
          {step === 1 && <>
            <View style={s.card}>
              <Text style={s.cardTitle}>What do you need help with?</Text>
              <View style={s.searchBox}>
                <Ionicons name="search" size={18} color={MUTED} />
                <TextInput style={s.searchInput} value={catSearch} onChangeText={setCatSearch} placeholder="Search a service (e.g., Plumbing, Electrical)" placeholderTextColor={MUTED} />
              </View>
              <View style={s.catGrid}>
                {cats.map(c => (
                  <TouchableOpacity key={c.value} style={[s.catTile, category === c.value && s.catTileOn]} onPress={() => setCategory(c.value)}>
                    <Text style={s.catEmoji}>{c.emoji}</Text>
                    <Text style={[s.catLabel, category === c.value && { color: BLUE }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>Describe the job</Text>
              <View style={s.textAreaWrap}>
                <TextInput style={s.textArea} value={description} onChangeText={t => setDescription(t.slice(0, 500))} multiline
                  placeholder="Please provide as much detail as possible…" placeholderTextColor={MUTED} />
                <Text style={s.counter}>{description.length}/500</Text>
              </View>
              <TouchableOpacity style={s.aiRow} onPress={() => router.push("/diagnose" as any)}>
                <Ionicons name="sparkles" size={16} color={BLUE} />
                <Text style={s.aiText}>Use AI to help describe your job</Text>
                <Ionicons name="chevron-forward" size={18} color={BLUE} />
              </TouchableOpacity>
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>Add photos <Text style={s.optional}>(optional)</Text></Text>
              <Text style={s.cardSub}>Add photos to help pros understand the job better.</Text>
              <View style={s.photoRow}>
                {photoUris.map((uri, i) => (
                  <View key={i} style={s.photoWrap}>
                    <Image source={{ uri }} style={s.photoThumb} />
                    <TouchableOpacity style={s.photoX} onPress={() => removePhoto(i)} hitSlop={8}><Ionicons name="close" size={12} color="#fff" /></TouchableOpacity>
                  </View>
                ))}
                {photoUris.length < 6 && (
                  <TouchableOpacity style={s.addPhoto} onPress={addPhotos} disabled={uploadingPhoto}>
                    {uploadingPhoto ? <ActivityIndicator color={BLUE} /> : <><Ionicons name="camera" size={22} color={BLUE} /><Text style={s.addPhotoText}>Add photo</Text></>}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>How urgent is this?</Text>
              <View style={s.urgRow}>
                {URGENCY.map(u => (
                  <TouchableOpacity key={u.value} style={[s.urgCard, urgency === u.value && s.urgCardOn]} onPress={() => setUrgency(u.value)}>
                    {urgency === u.value && <View style={s.urgCheck}><Ionicons name="checkmark" size={11} color="#fff" /></View>}
                    <Ionicons name={u.icon as any} size={20} color={u.color} />
                    <Text style={s.urgLabel}>{u.label}</Text>
                    <Text style={s.urgDesc}>{u.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={s.aiPriceHint}>
              <View style={s.aiHintHead}>
                <Ionicons name="sparkles" size={18} color={BLUE} />
                <Text style={s.aiHintTitle}>AI price and time estimate</Text>
              </View>
              <Text style={s.aiHintBody}>Complete your job details and Tarea will estimate the price and minimum time before you post.</Text>
            </View>

            <View style={s.autoSaveRow}>
              <Ionicons name="save-outline" size={16} color={MUTED} />
              <Text style={s.autoSaveText}>Auto-save draft</Text>
              <Switch value={autoSave} onValueChange={setAutoSave} trackColor={{ true: BLUE, false: "#CBD5E1" }} thumbColor="#fff" />
            </View>
          </>}

          {/* ── STEP 2 · SCHEDULE ── */}
          {step === 2 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>When do you need it?</Text>
              <Text style={s.cardSub}>Pick a preferred date and time — you can adjust with your pro later.</Text>
              <View style={s.row}>
                <TouchableOpacity style={[s.pill, { flex: 1 }]} onPress={() => { setShowTime(false); setShowDate(true); }}>
                  <Ionicons name="calendar-outline" size={18} color={MUTED} />
                  <Text style={{ color: dateObj ? INK : MUTED, fontSize: 14 }}>{dateObj ? dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Date"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.pill, { flex: 1 }]} onPress={() => { setShowDate(false); setShowTime(true); }}>
                  <Ionicons name="time-outline" size={18} color={MUTED} />
                  <Text style={{ color: dateObj ? INK : MUTED, fontSize: 14 }}>{dateObj ? dateObj.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "Time"}</Text>
                </TouchableOpacity>
              </View>
              {showDate && (
                <DateTimePicker value={dateObj ?? new Date()} mode="date" display={Platform.OS === "ios" ? "inline" : "default"} themeVariant="light" minimumDate={new Date()}
                  style={Platform.OS === "ios" ? { alignSelf: "center", height: 400, width: "100%" } : undefined}
                  onChange={(e, sel) => { if (Platform.OS === "android") setShowDate(false); if (e.type === "set" && sel) setDateObj(prev => { const d = new Date(sel); if (prev) d.setHours(prev.getHours(), prev.getMinutes(), 0, 0); return d; }); }} />
              )}
              {showTime && (
                <DateTimePicker value={dateObj ?? new Date()} mode="time" display={Platform.OS === "ios" ? "spinner" : "default"} themeVariant="light"
                  onChange={(e, sel) => { if (Platform.OS === "android") setShowTime(false); if (e.type === "set" && sel) setDateObj(prev => { const d = new Date(prev ?? new Date()); d.setHours(sel.getHours(), sel.getMinutes(), 0, 0); return d; }); }} />
              )}
              {Platform.OS === "ios" && (showDate || showTime) && (
                <TouchableOpacity style={s.doneBtn} onPress={() => { setShowDate(false); setShowTime(false); }}><Text style={s.doneText}>Done</Text></TouchableOpacity>
              )}
            </View>
          )}

          {/* ── STEP 3 · LOCATION ── */}
          {step === 3 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Where is the job?</Text>
              <Text style={s.label}>Service address</Text>
              <TextInput style={s.input} value={address} onChangeText={setAddress} placeholder="Street address where the job is" placeholderTextColor={MUTED} />
              <Text style={s.hint}>This address is just for this job — it doesn't change your account.</Text>
              <Text style={s.label}>Apartment / unit (optional)</Text>
              <TextInput style={s.input} value={unit} onChangeText={setUnit} placeholder="Apt, suite, unit, floor…" placeholderTextColor={MUTED} />
              <Text style={s.label}>City</Text>
              <TextInput style={s.input} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={MUTED} />
            </View>
          )}

          {/* ── STEP 4 · AI JOB ESTIMATE ── */}
          {step === 4 && <>
            <View style={s.estCard}>
              <View style={s.estHead}><Ionicons name="sparkles" size={18} color={BLUE} /><Text style={s.estTitle}>AI Job Estimate</Text></View>
              <Text style={s.estJob} numberOfLines={1}>{description.trim().split("\n")[0] || catLabel(category)}</Text>

              {aiLoading ? (
                <View style={s.aiLoadingRow}><ActivityIndicator color={BLUE} /><Text style={s.aiLoadingText}>Analyzing your job…</Text></View>
              ) : aiPrice ? (<>
                <View style={s.estPriceBlock}>
                  <Text style={s.estPrice}>{aiPrice.isFixed ? `$${effMin}` : `$${aiPrice.min}–$${aiPrice.max}`}</Text>
                  <Text style={s.estPriceLabel}>{aiPrice.isFixed ? "Estimated fixed price" : "Estimated range"}{urgency === "URGENT" ? "  ·  incl. rush" : ""}</Text>
                </View>

                {aiPrice.breakdown && (
                  <View style={s.splitRow}>
                    <View style={s.splitCell}><Text style={s.splitLabel}>Labor & service</Text><Text style={s.splitValue}>${Math.max(0, (aiPrice.isFixed ? effMin : aiPrice.max) - aiPrice.breakdown.materials)}</Text></View>
                    <View style={s.splitDivider} />
                    <View style={s.splitCell}><Text style={s.splitLabel}>Materials & furniture</Text><Text style={s.splitValue}>${aiPrice.breakdown.materials}</Text></View>
                  </View>
                )}

                <View style={s.estGrid}>
                  <View style={s.estCell}><Text style={s.estCellLabel}>Estimated work time</Text><Text style={s.estCellValue}>{aiPrice.workTime || "—"}</Text></View>
                  <View style={s.estCell}><Text style={s.estCellLabel}>Minimum appointment</Text><Text style={s.estCellValue}>{aiPrice.minWindow} hour{aiPrice.minWindow === 1 ? "" : "s"}</Text></View>
                  <View style={s.estCell}><Text style={s.estCellLabel}>Earliest availability</Text><Text style={s.estCellValue}>{dateObj ? dateObj.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "Flexible"}</Text></View>
                  <View style={s.estCell}><Text style={s.estCellLabel}>Confidence</Text><Text style={[s.estCellValue, { color: aiPrice.confidence >= 80 ? "#10B981" : aiPrice.confidence >= 60 ? "#F59E0B" : "#EF4444" }]}>{aiPrice.confidenceLabel} — {aiPrice.confidence}%</Text></View>
                </View>

                {aiPrice.included.length > 0 && <>
                  <Text style={s.estSection}>Included</Text>
                  {aiPrice.included.map((x, i) => <View key={i} style={s.incRow}><Ionicons name="checkmark-circle" size={16} color="#10B981" /><Text style={s.incText}>{x}</Text></View>)}
                </>}
                {aiPrice.notIncluded.length > 0 && <>
                  <Text style={s.estSection}>Not included</Text>
                  {aiPrice.notIncluded.map((x, i) => <View key={i} style={s.incRow}><Ionicons name="close-circle" size={16} color="#EF4444" /><Text style={s.incText}>{x}</Text></View>)}
                </>}

                <View style={s.disclaimer}>
                  <Ionicons name="information-circle-outline" size={15} color={MUTED} />
                  <Text style={s.disclaimerText}>Estimate only. Final price is confirmed before work begins — the pro must get your approval for any scope change.</Text>
                </View>
                <TouchableOpacity onPress={fetchAiPrice} style={{ alignSelf: "center", marginTop: 8 }}><Text style={s.secondaryText}>↻ Re-estimate</Text></TouchableOpacity>
              </>) : (
                <TouchableOpacity style={s.aiBtn} onPress={fetchAiPrice} disabled={!description.trim()}>
                  <Ionicons name="sparkles" size={16} color="#fff" /><Text style={s.aiBtnText}>Get AI Estimate</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>Job summary</Text>
              <ReviewRow label="Service" value={`${CATEGORIES.find(c => c.value === category)?.emoji ?? ""} ${catLabel(category)}`} onEdit={() => setStep(1)} />
              <ReviewRow label="Urgency" value={URGENCY.find(u => u.value === urgency)?.label ?? "Standard"} onEdit={() => setStep(1)} />
              <ReviewRow label="Photos"  value={photoUris.length ? `${photoUris.length} attached` : "None"} onEdit={() => setStep(1)} />
              <ReviewRow label="When"    value={dateObj ? dateObj.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"} onEdit={() => setStep(2)} />
              <ReviewRow label="Where"   value={[unit ? `${address}, ${unit}` : address, city].filter(Boolean).join(" · ") || "—"} onEdit={() => setStep(3)} last />
            </View>
          </>}

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Bottom CTA */}
        <View style={s.footer}>
          {step < 4 ? (
            <TouchableOpacity style={s.cta} onPress={next} activeOpacity={0.9}>
              <Text style={s.ctaText}>Continue</Text>
              <View style={s.ctaArrow}><Ionicons name="arrow-forward" size={18} color={BLUE} /></View>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={[s.cta, submitting && { opacity: 0.6 }]} onPress={() => submit(false)} disabled={submitting || aiLoading} activeOpacity={0.9}>
                {submitting ? <ActivityIndicator color="#fff" /> : <>
                  <Text style={s.ctaText}>{directed ? `Send request to ${params.proName || "pro"}` : "Accept estimate & post job"}</Text>
                  <View style={s.ctaArrow}><Ionicons name="arrow-forward" size={18} color={BLUE} /></View>
                </>}
              </TouchableOpacity>
              <View style={s.footRow}>
                <TouchableOpacity onPress={() => setStep(1)} disabled={submitting} hitSlop={8}><Text style={s.footLink}>Edit details</Text></TouchableOpacity>
                {!directed && <TouchableOpacity onPress={() => submit(true)} disabled={submitting} hitSlop={8}><Text style={s.footLink}>Request an in-person quote</Text></TouchableOpacity>}
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BreakRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={s.breakRow}>
      <Text style={s.breakLabel}>{label}</Text>
      <Text style={s.breakValue}>${value}</Text>
    </View>
  );
}

function ReviewRow({ label, value, onEdit, last }: { label: string; value: string; onEdit: () => void; last?: boolean }) {
  return (
    <View style={[s.revRow, !last && s.revBorder]}>
      <View style={{ flex: 1 }}>
        <Text style={s.revLabel}>{label}</Text>
        <Text style={s.revValue} numberOfLines={2}>{value}</Text>
      </View>
      <TouchableOpacity onPress={onEdit} hitSlop={8}><Text style={s.revEdit}>Edit</Text></TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: "#F6F8FC" },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 6 },
  backBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: LINE },
  hTitle:        { color: INK, fontSize: 20, fontWeight: "900" },
  saveDraft:     { color: BLUE, fontSize: 15, fontWeight: "700" },
  hSub:          { color: MUTED, fontSize: 13, textAlign: "center", marginTop: 4, paddingHorizontal: 40, lineHeight: 18 },

  steps:         { flexDirection: "row", paddingHorizontal: 8, marginTop: 16, marginBottom: 6 },
  stepItem:      { flex: 1, alignItems: "center" },
  stepNodeRow:   { flexDirection: "row", alignItems: "center", width: "100%", justifyContent: "center" },
  stepLine:      { flex: 1, height: 2, backgroundColor: LINE },
  stepNode:      { width: 26, height: 26, borderRadius: 13, backgroundColor: "#fff", borderWidth: 1.5, borderColor: LINE, alignItems: "center", justifyContent: "center" },
  stepNodeOn:    { backgroundColor: BLUE, borderColor: BLUE },
  stepNum:       { color: MUTED, fontSize: 12, fontWeight: "800" },
  stepLabel:     { color: MUTED, fontSize: 11, fontWeight: "600", marginTop: 4 },

  scroll:        { padding: 16, paddingBottom: 220 },
  card:          { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#EEF2F7" },
  cardTitle:     { color: INK, fontSize: 16, fontWeight: "800" },
  cardSub:       { color: MUTED, fontSize: 12.5, marginTop: 4, lineHeight: 18 },
  optional:      { color: MUTED, fontWeight: "500", fontSize: 13 },

  searchBox:     { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: LINE, borderRadius: 12, paddingHorizontal: 12, height: 46, marginTop: 12 },
  searchInput:   { flex: 1, color: INK, fontSize: 14 },
  catGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  catTile:       { width: "31%", aspectRatio: 1, borderRadius: 14, borderWidth: 1, borderColor: LINE, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", gap: 6 },
  catTileOn:     { borderColor: BLUE, backgroundColor: "#EFF5FF" },
  catEmoji:      { fontSize: 26 },
  catLabel:      { color: INK, fontSize: 12, fontWeight: "700" },

  textAreaWrap:  { marginTop: 12, borderWidth: 1, borderColor: LINE, borderRadius: 12, padding: 12 },
  textArea:      { color: INK, fontSize: 14, minHeight: 96, textAlignVertical: "top" },
  counter:       { color: MUTED, fontSize: 11, alignSelf: "flex-end" },
  aiRow:         { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#EFF5FF", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 12 },
  aiText:        { flex: 1, color: BLUE, fontSize: 14, fontWeight: "700" },

  photoRow:      { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  photoWrap:     { position: "relative" },
  photoThumb:    { width: 72, height: 72, borderRadius: 12, backgroundColor: SURFACE },
  photoX:        { position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(15,23,42,0.7)", alignItems: "center", justifyContent: "center" },
  addPhoto:      { width: 72, height: 72, borderRadius: 12, borderWidth: 1.5, borderColor: "#C7D7FF", borderStyle: "dashed", backgroundColor: "#EFF5FF", alignItems: "center", justifyContent: "center", gap: 2 },
  addPhotoText:  { color: BLUE, fontSize: 10, fontWeight: "700" },

  urgRow:        { flexDirection: "row", gap: 8, marginTop: 12 },
  urgCard:       { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 14, padding: 10, alignItems: "flex-start", gap: 4 },
  urgCardOn:     { borderColor: BLUE, backgroundColor: "#EFF5FF" },
  urgCheck:      { position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: BLUE, alignItems: "center", justifyContent: "center" },
  urgLabel:      { color: INK, fontSize: 13, fontWeight: "800", marginTop: 2 },
  urgDesc:       { color: MUTED, fontSize: 10.5, lineHeight: 14 },

  budgetRow:     { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  budgetInput:   { flex: 1, flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: LINE, borderRadius: 12, paddingHorizontal: 12, height: 48 },
  dollar:        { color: MUTED, fontSize: 15, fontWeight: "700" },
  budgetField:   { flex: 1, color: INK, fontSize: 14 },
  dash:          { color: MUTED, fontSize: 16 },
  notSure:       { alignItems: "center", gap: 2 },
  notSureText:   { color: MUTED, fontSize: 11, fontWeight: "600" },
  rushNote:      { color: "#B45309", fontSize: 12, fontWeight: "600", marginTop: 12, lineHeight: 17 },
  aiPriceHint:   { backgroundColor: "#EFF5FF", borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#DBE7FF" },
  aiHintHead:    { flexDirection: "row", alignItems: "center", gap: 8 },
  aiHintTitle:   { color: BLUE, fontSize: 15, fontWeight: "800" },
  aiHintBody:    { color: "#475569", fontSize: 13, lineHeight: 18, marginTop: 6 },
  autoSaveRow:   { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 14, borderWidth: 1, borderColor: "#EEF2F7" },
  autoSaveText:  { flex: 1, color: INK, fontSize: 14, fontWeight: "600" },
  aiCard:        { backgroundColor: "#0F172A", borderRadius: 18, padding: 18, marginBottom: 14, alignItems: "center" },
  aiHead:        { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" },
  aiTitle:       { color: "#fff", fontSize: 15, fontWeight: "800" },
  aiLoadingRow:  { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  aiLoadingText: { color: "#CBD5E1", fontSize: 14 },
  aiPriceValue:  { color: "#fff", fontSize: 46, fontWeight: "900", marginTop: 10, letterSpacing: -1 },
  aiPriceLabel:  { color: "#93B4F5", fontSize: 13, fontWeight: "700" },
  aiNote:        { color: "#CBD5E1", fontSize: 12.5, textAlign: "center", lineHeight: 18, marginTop: 10 },
  aiBtn:         { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: BLUE, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12, marginTop: 14 },
  aiBtnText:     { color: "#fff", fontSize: 14, fontWeight: "800" },
  link:          { color: "#93B4F5", fontSize: 13, fontWeight: "700" },
  breakdown:     { width: "100%", marginTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", paddingTop: 12, gap: 7 },
  breakRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  breakLabel:    { color: "#93A4BE", fontSize: 12.5, flex: 1 },
  breakValue:    { color: "#E2E8F0", fontSize: 12.5, fontWeight: "700" },
  secondaryBtn:  { alignItems: "center", paddingVertical: 12, marginTop: 8 },
  secondaryText: { color: BLUE, fontSize: 14, fontWeight: "700" },
  estCard:       { backgroundColor: "#fff", borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: "#E6ECF5" },
  estHead:       { flexDirection: "row", alignItems: "center", gap: 8 },
  estTitle:      { color: INK, fontSize: 16, fontWeight: "800" },
  estJob:        { color: MUTED, fontSize: 13, marginTop: 2 },
  estPriceBlock: { alignItems: "center", marginTop: 16, marginBottom: 4 },
  estPrice:      { color: BLUE, fontSize: 44, fontWeight: "900", letterSpacing: -1 },
  estPriceLabel: { color: MUTED, fontSize: 13, fontWeight: "600", marginTop: 2 },
  splitRow:      { flexDirection: "row", alignItems: "center", backgroundColor: SURFACE, borderRadius: 12, padding: 12, marginTop: 12 },
  splitCell:     { flex: 1, alignItems: "center" },
  splitDivider:  { width: 1, height: 30, backgroundColor: LINE },
  splitLabel:    { color: MUTED, fontSize: 11.5, fontWeight: "600" },
  splitValue:    { color: INK, fontSize: 17, fontWeight: "900", marginTop: 3 },
  estGrid:       { flexDirection: "row", flexWrap: "wrap", marginTop: 12, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8 },
  estCell:       { width: "50%", paddingVertical: 8, paddingRight: 8 },
  estCellLabel:  { color: MUTED, fontSize: 11.5 },
  estCellValue:  { color: INK, fontSize: 14, fontWeight: "800", marginTop: 2 },
  estSection:    { color: INK, fontSize: 13, fontWeight: "800", marginTop: 14, marginBottom: 8 },
  incRow:        { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  incText:       { flex: 1, color: "#334155", fontSize: 13, lineHeight: 18 },
  disclaimer:    { flexDirection: "row", gap: 8, backgroundColor: SURFACE, borderRadius: 12, padding: 12, marginTop: 16 },
  disclaimerText:{ flex: 1, color: MUTED, fontSize: 12, lineHeight: 17 },
  footRow:       { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, marginTop: 12 },
  footLink:      { color: BLUE, fontSize: 14, fontWeight: "700" },

  label:         { color: "#334155", fontSize: 13, fontWeight: "700", marginBottom: 6, marginTop: 14 },
  input:         { backgroundColor: "#fff", borderRadius: 12, padding: 14, color: INK, fontSize: 14, borderWidth: 1, borderColor: LINE },
  hint:          { color: MUTED, fontSize: 12, lineHeight: 16, marginTop: 6 },
  row:           { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  pill:          { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: LINE, borderRadius: 12, paddingHorizontal: 14, minHeight: 50, paddingVertical: 6 },
  doneBtn:       { alignSelf: "flex-end", paddingVertical: 8, paddingHorizontal: 14, marginTop: 4 },
  doneText:      { color: BLUE, fontWeight: "800", fontSize: 15 },

  revRow:        { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  revBorder:     { borderBottomWidth: 1, borderBottomColor: LINE },
  revLabel:      { color: MUTED, fontSize: 12, fontWeight: "600" },
  revValue:      { color: INK, fontSize: 14, fontWeight: "700", marginTop: 2 },
  revEdit:       { color: BLUE, fontSize: 13, fontWeight: "700" },

  footer:        { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20, backgroundColor: "#F6F8FC", borderTopWidth: 1, borderTopColor: "#EAEEF5" },
  cta:           { backgroundColor: BLUE, borderRadius: 28, height: 58, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  ctaText:       { color: "#fff", fontSize: 16, fontWeight: "800" },
  ctaArrow:      { position: "absolute", right: 8, width: 42, height: 42, borderRadius: 21, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },

  successBox:    { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 },
  successCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: "#10B981", alignItems: "center", justifyContent: "center" },
  successTitle:  { color: INK, fontSize: 26, fontWeight: "900" },
  successSub:    { color: MUTED, fontSize: 15, textAlign: "center", lineHeight: 22 },
});

import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";
import BackBar from "@/components/ui/BackBar";
import { SafeAreaView } from "react-native-safe-area-context";

const SERVICES = [
  { category: "PLUMBING",         emoji: "🔧", label: "Plumbing",         desc: "Pipes, leaks, faucets, drains" },
  { category: "ELECTRICAL",       emoji: "⚡", label: "Electrical",       desc: "Wiring, outlets, panels, lighting" },
  { category: "CARPENTRY",        emoji: "🔨", label: "Carpentry",        desc: "Furniture, framing, doors" },
  { category: "PAINTING",         emoji: "🎨", label: "Painting",         desc: "Interior, exterior, wallpaper" },
  { category: "CLEANING",         emoji: "🧹", label: "Cleaning",         desc: "Deep clean, move-in/out" },
  { category: "HVAC",             emoji: "❄️", label: "HVAC",             desc: "AC, heating, ventilation" },
  { category: "ROOFING",          emoji: "🏠", label: "Roofing",          desc: "Repairs, gutters, inspections" },
  { category: "LANDSCAPING",      emoji: "🌿", label: "Landscaping",      desc: "Lawn care, trimming, planting" },
  { category: "MOVING",           emoji: "📦", label: "Moving",           desc: "Packing, hauling, assembly" },
  { category: "APPLIANCE_REPAIR", emoji: "🔌", label: "Appliance Repair", desc: "Washer, dryer, fridge" },
  { category: "GENERAL",          emoji: "🛠️", label: "General",          desc: "Odd jobs, handyman tasks" },
];

type Detail = { category: string; title: string; description: string; minPrice: string; maxPrice: string; duration: string };

export default function OnboardingServicesScreen() {
  const router = useRouter();
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [details, setDetails]       = useState<Record<string, Detail>>({});
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);

  // Restore already-selected services so users don't start over after logging out.
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/profile");
        if (!res.ok) return;
        const d = await res.json();
        const svcs: any[] = d.handymanProfile?.services || [];
        if (!svcs.length) return;
        const sel = new Set<string>();
        const det: Record<string, Detail> = {};
        for (const s of svcs) {
          sel.add(s.category);
          det[s.category] = {
            category: s.category, title: s.title || "", description: s.description || "",
            minPrice: String(s.minPrice ?? "50"), maxPrice: String(s.maxPrice ?? "150"), duration: String(s.duration ?? "60"),
          };
        }
        setSelected(sel);
        setDetails(det);
      } catch { /* ignore — user can re-select */ }
    })();
  }, []);

  const toggle = (cat: string, label: string, desc: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(cat)) { next.delete(cat); }
      else {
        next.add(cat);
        if (!details[cat]) setDetails(d => ({ ...d, [cat]: { category: cat, title: label, description: desc, minPrice: "50", maxPrice: "150", duration: "60" } }));
      }
      return next;
    });
    setExpanded(cat);
  };

  const update = (cat: string, field: keyof Detail, value: string) => {
    setDetails(d => ({ ...d, [cat]: { ...d[cat], [field]: value } }));
  };

  const next = async () => {
    if (selected.size === 0) { Alert.alert("Required", "Select at least one service"); return; }
    setSaving(true);
    const bio   = await SecureStore.getItemAsync("ob_bio")   ?? "";
    const rate  = await SecureStore.getItemAsync("ob_rate")  ?? "50";
    const years = await SecureStore.getItemAsync("ob_years") ?? "1";
    const res = await api.post("/handyman/onboarding", {
      bio, hourlyRate: rate, yearsExperience: years,
      services: Array.from(selected).map(cat => details[cat]),
    });
    if (res.ok) router.push("/(handyman)/onboarding-availability");
    else Alert.alert("Error", "Failed to save. Try again.");
    setSaving(false);
  };

  return (
    <SafeAreaView style={s.safe}>
      <BackBar />
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Your Services</Text>
          <Text style={s.sub}>Step 2 of 3 · Select all services you offer</Text>
        </View>

        <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled">
          {SERVICES.map(({ category, emoji, label, desc }) => {
            const isOn   = selected.has(category);
            const detail = details[category];
            const isExp  = expanded === category && isOn;
            return (
              <View key={category} style={[s.serviceCard, isOn && s.serviceCardOn]}>
                <TouchableOpacity style={s.serviceRow} onPress={() => toggle(category, label, desc)}>
                  <Text style={s.serviceEmoji}>{emoji}</Text>
                  <View style={s.serviceInfo}>
                    <Text style={[s.serviceLabel, isOn && s.serviceLabelOn]}>{label}</Text>
                    <Text style={s.serviceDesc}>{desc}</Text>
                  </View>
                  <View style={[s.check, isOn && s.checkOn]}>
                    {isOn && <Text style={s.checkMark}>✓</Text>}
                  </View>
                </TouchableOpacity>

                {isOn && detail && (
                  <View style={s.detailForm}>
                    <View style={s.detailRow}>
                      <View style={s.detailField}>
                        <Text style={s.detailLabel}>Min Price ($)</Text>
                        <TextInput style={s.detailInput} value={detail.minPrice} onChangeText={v => update(category, "minPrice", v)} keyboardType="numeric" placeholderTextColor={C.slate500} />
                      </View>
                      <View style={s.detailField}>
                        <Text style={s.detailLabel}>Max Price ($)</Text>
                        <TextInput style={s.detailInput} value={detail.maxPrice} onChangeText={v => update(category, "maxPrice", v)} keyboardType="numeric" placeholderTextColor={C.slate500} />
                      </View>
                      <View style={s.detailField}>
                        <Text style={s.detailLabel}>Duration (min)</Text>
                        <TextInput style={s.detailInput} value={detail.duration} onChangeText={v => update(category, "duration", v)} keyboardType="numeric" placeholderTextColor={C.slate500} />
                      </View>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: 20 }} />
        </ScrollView>

        <TouchableOpacity style={[s.btn, (saving || selected.size === 0) && s.btnDisabled]} onPress={next} disabled={saving || selected.size === 0}>
          {saving ? <ActivityIndicator color={C.ink} /> : <Text style={s.btnText}>Next — Set Availability ({selected.size} selected) →</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: C.bg },
  container:      { flex: 1, padding: 16, gap: 12 },
  header:         { paddingBottom: 4 },
  title:          { color: C.text, fontSize: 24, fontWeight: "900" },
  sub:            { color: C.textMuted, fontSize: 13, marginTop: 2 },
  scroll:         { flex: 1 },
  serviceCard:    { backgroundColor: C.surface, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  serviceCardOn:  { borderColor: C.sky },
  serviceRow:     { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  serviceEmoji:   { fontSize: 24 },
  serviceInfo:    { flex: 1 },
  serviceLabel:   { color: C.text, fontWeight: "700", fontSize: 15 },
  serviceLabelOn: { color: C.sky },
  serviceDesc:    { color: C.slate500, fontSize: 12, marginTop: 1 },
  check:          { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  checkOn:        { backgroundColor: C.sky, borderColor: C.sky },
  checkMark:      { color: C.ink, fontWeight: "900", fontSize: 13 },
  detailForm:     { borderTopWidth: 1, borderTopColor: "rgba(56,189,248,0.15)", padding: 12 },
  detailRow:      { flexDirection: "row", gap: 8 },
  detailField:    { flex: 1 },
  detailLabel:    { color: C.textMuted, fontSize: 11, fontWeight: "600", marginBottom: 4 },
  detailInput:    { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 8, color: C.text, fontSize: 13, textAlign: "center" },
  btn:            { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  btnDisabled:    { opacity: 0.4 },
  btnText:        { color: C.ink, fontWeight: "800", fontSize: 15 },
});

import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";
import BackBar from "@/components/ui/BackBar";
import { SafeAreaView } from "react-native-safe-area-context";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12;
  const ampm = i < 12 ? "AM" : "PM";
  return { value: i, label: `${h}:00 ${ampm}` };
});

type Slot = { dayOfWeek: number; startHour: number; endHour: number };

export default function OnboardingAvailabilityScreen() {
  const router = useRouter();
  const [activeDays, setActiveDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [slots, setSlots]           = useState<Record<number, Slot>>(
    Object.fromEntries([1, 2, 3, 4, 5].map(d => [d, { dayOfWeek: d, startHour: 8, endHour: 18 }]))
  );
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [saving, setSaving]           = useState(false);

  // Restore already-saved availability so users don't start over after logging out.
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/profile");
        if (!res.ok) return;
        const d = await res.json();
        const avail: any[] = d.handymanProfile?.availability || [];
        if (!avail.length) return;
        const days = new Set<number>();
        const sl: Record<number, Slot> = {};
        for (const a of avail) {
          days.add(a.dayOfWeek);
          sl[a.dayOfWeek] = { dayOfWeek: a.dayOfWeek, startHour: a.startHour, endHour: a.endHour };
        }
        setActiveDays(days);
        setSlots(sl);
      } catch { /* ignore — defaults remain */ }
    })();
  }, []);

  const toggleDay = (d: number) => {
    setActiveDays(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
    if (!slots[d]) setSlots(p => ({ ...p, [d]: { dayOfWeek: d, startHour: 8, endHour: 18 } }));
  };

  const cycleHour = (d: number, field: "startHour" | "endHour", dir: 1 | -1) => {
    setSlots(p => {
      const slot = p[d] ?? { dayOfWeek: d, startHour: 8, endHour: 18 };
      const current = slot[field];
      const next = (current + dir + 24) % 24;
      return { ...p, [d]: { ...slot, [field]: next } };
    });
  };

  const finish = async () => {
    if (activeDays.size === 0) { Alert.alert("Required", "Select at least one available day"); return; }
    setSaving(true);
    const availSlots = Array.from(activeDays).map(d => slots[d]).filter(Boolean);
    const res = await api.post("/handyman/availability", { slots: availSlots });
    if (res.ok) {
      await SecureStore.deleteItemAsync("ob_bio");
      await SecureStore.deleteItemAsync("ob_rate");
      await SecureStore.deleteItemAsync("ob_years");
      router.replace("/(handyman)/background-check");
    } else {
      Alert.alert("Error", "Failed to save availability. Try again.");
    }
    setSaving(false);
  };

  return (
    <SafeAreaView style={s.safe}>
      <BackBar />
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Your Availability</Text>
          <Text style={s.sub}>Step 3 of 3 · Choose when you're open for bookings</Text>
        </View>

        <ScrollView style={s.scroll}>
          {DAYS.map((dayName, d) => {
            const active = activeDays.has(d);
            const slot   = slots[d] ?? { startHour: 8, endHour: 18 };
            const isExp  = expandedDay === d && active;
            return (
              <View key={d} style={[s.dayCard, active && s.dayCardOn]}>
                <TouchableOpacity style={s.dayRow} onPress={() => { toggleDay(d); if (!active) setExpandedDay(d); }}>
                  <View style={[s.check, active && s.checkOn]}>
                    {active && <Text style={s.checkMark}>✓</Text>}
                  </View>
                  <Text style={[s.dayName, active && s.dayNameOn]}>{dayName}</Text>
                  {active && (
                    <Text style={s.dayHours}>{HOURS[slot.startHour].label} – {HOURS[slot.endHour].label}</Text>
                  )}
                  {active && (
                    <TouchableOpacity onPress={() => setExpandedDay(isExp ? null : d)} style={s.editBtn}>
                      <Text style={s.editBtnText}>{isExp ? "▲" : "▼"}</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>

                {isExp && (
                  <View style={s.hourPickers}>
                    {(["startHour", "endHour"] as const).map(field => (
                      <View key={field} style={s.picker}>
                        <Text style={s.pickerLabel}>{field === "startHour" ? "Start" : "End"}</Text>
                        <TouchableOpacity style={s.pickerBtn} onPress={() => cycleHour(d, field, 1)}>
                          <Text style={s.pickerArrow}>▲</Text>
                        </TouchableOpacity>
                        <Text style={s.pickerValue}>{HOURS[slot[field]].label}</Text>
                        <TouchableOpacity style={s.pickerBtn} onPress={() => cycleHour(d, field, -1)}>
                          <Text style={s.pickerArrow}>▼</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: 20 }} />
        </ScrollView>

        <TouchableOpacity style={[s.btn, saving && s.btnDisabled]} onPress={finish} disabled={saving}>
          {saving ? <ActivityIndicator color={C.ink} /> : <Text style={s.btnText}>Finish Setup →</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.ink },
  container:   { flex: 1, padding: 16, gap: 12 },
  header:      { paddingBottom: 4 },
  title:       { color: C.white, fontSize: 24, fontWeight: "900" },
  sub:         { color: C.slate400, fontSize: 13, marginTop: 2 },
  scroll:      { flex: 1 },
  dayCard:     { backgroundColor: "#1E293B", borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", overflow: "hidden" },
  dayCardOn:   { borderColor: "rgba(56,189,248,0.3)" },
  dayRow:      { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  check:       { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  checkOn:     { backgroundColor: C.sky, borderColor: C.sky },
  checkMark:   { color: C.ink, fontWeight: "900", fontSize: 12 },
  dayName:     { color: C.slate400, fontWeight: "700", fontSize: 15, width: 36 },
  dayNameOn:   { color: C.sky },
  dayHours:    { flex: 1, color: C.slate400, fontSize: 12 },
  editBtn:     { padding: 4 },
  editBtnText: { color: C.slate400, fontSize: 12 },
  hourPickers: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)", padding: 14, gap: 16, justifyContent: "center" },
  picker:      { alignItems: "center", gap: 6, flex: 1 },
  pickerLabel: { color: C.slate400, fontSize: 11, fontWeight: "600" },
  pickerBtn:   { padding: 8 },
  pickerArrow: { color: C.sky, fontSize: 16, fontWeight: "700" },
  pickerValue: { color: C.white, fontWeight: "700", fontSize: 14 },
  btn:         { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: C.ink, fontWeight: "800", fontSize: 16 },
});

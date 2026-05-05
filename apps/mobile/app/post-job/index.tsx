import { useState } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet,
  Alert, ActivityIndicator, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { api } from "../../constants/api";
import { colors, fontSize, radius, spacing } from "../../constants/theme";

const CATEGORIES = [
  { key: "PLUMBING", emoji: "🔧", label: "Plumbing" },
  { key: "ELECTRICAL", emoji: "⚡", label: "Electrical" },
  { key: "CARPENTRY", emoji: "🔨", label: "Carpentry" },
  { key: "PAINTING", emoji: "🎨", label: "Painting" },
  { key: "CLEANING", emoji: "🧹", label: "Cleaning" },
  { key: "HVAC", emoji: "❄️", label: "HVAC" },
  { key: "ROOFING", emoji: "🏠", label: "Roofing" },
  { key: "LANDSCAPING", emoji: "🌿", label: "Landscaping" },
  { key: "MOVING", emoji: "📦", label: "Moving" },
  { key: "APPLIANCE_REPAIR", emoji: "🔌", label: "Appliance Repair" },
  { key: "GENERAL", emoji: "🛠️", label: "General" },
];

const EMPTY = {
  category: "PLUMBING", title: "", description: "",
  address: "", city: "", budgetMin: "", budgetMax: "", scheduledAt: "",
  latitude: "", longitude: "",
};

export default function PostJobScreen() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const detectLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission denied", "Allow location access to auto-fill address."); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      set("latitude", String(latitude));
      set("longitude", String(longitude));
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (place) {
        if (place.street) set("address", [place.streetNumber, place.street].filter(Boolean).join(" "));
        if (place.city) set("city", place.city);
      }
    } catch { Alert.alert("Error", "Could not get location"); }
    finally { setLocating(false); }
  };

  const submit = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.address.trim() || !form.city.trim()) {
      Alert.alert("Please fill in all required fields"); return;
    }
    if (!form.scheduledAt) { Alert.alert("Please enter a scheduled date"); return; }
    const min = parseFloat(form.budgetMin), max = parseFloat(form.budgetMax);
    if (isNaN(min) || min <= 0 || isNaN(max) || max <= 0) { Alert.alert("Enter valid budget range"); return; }
    if (max < min) { Alert.alert("Max budget must be ≥ min budget"); return; }

    setSaving(true);
    try {
      await api.post("/job-requests", {
        category: form.category,
        title: form.title.trim(),
        description: form.description.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        budgetMin: min,
        budgetMax: max,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      });
      Alert.alert("Posted!", "Handymen near you will be notified.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      Alert.alert("Error", (e as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to post job");
    }
    setSaving(false);
  };

  const selectedCat = CATEGORIES.find(c => c.key === form.category);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </Pressable>
        <Text style={styles.topTitle}>Post a Job</Text>
        <Pressable onPress={submit} disabled={saving}>
          <Text style={[styles.postBtn, saving && { opacity: 0.5 }]}>{saving ? "Posting…" : "Post"}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Category */}
        <View style={styles.field}>
          <Text style={styles.label}>Category</Text>
          <Pressable style={styles.picker} onPress={() => setCatOpen(v => !v)}>
            <Text style={styles.pickerText}>{selectedCat?.emoji} {selectedCat?.label}</Text>
            <Ionicons name={catOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.inkSubtle} />
          </Pressable>
          {catOpen && (
            <View style={styles.catList}>
              {CATEGORIES.map(c => (
                <Pressable key={c.key}
                  style={[styles.catOption, form.category === c.key && styles.catOptionActive]}
                  onPress={() => { set("category", c.key); setCatOpen(false); }}>
                  <Text style={styles.catText}>{c.emoji} {c.label}</Text>
                  {form.category === c.key && <Ionicons name="checkmark" size={16} color={colors.skyBlue} />}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.label}>Job Title</Text>
          <TextInput style={styles.input} value={form.title} onChangeText={v => set("title", v)}
            placeholder="e.g. Fix leaking kitchen sink" placeholderTextColor={colors.inkSubtle} />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, { height: 90, textAlignVertical: "top" }]}
            value={form.description} onChangeText={v => set("description", v)}
            placeholder="Describe the job in detail..." placeholderTextColor={colors.inkSubtle} multiline />
        </View>

        {/* Location */}
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Location</Text>
            <Pressable onPress={detectLocation} disabled={locating} style={styles.gpsBtn}>
              {locating
                ? <ActivityIndicator size="small" color={colors.skyBlue} />
                : <><Ionicons name="locate" size={14} color={colors.skyBlue} /><Text style={styles.gpsBtnText}>Detect</Text></>
              }
            </Pressable>
          </View>
          <TextInput style={[styles.input, { marginBottom: 8 }]} value={form.address}
            onChangeText={v => set("address", v)} placeholder="Street address" placeholderTextColor={colors.inkSubtle} />
          <TextInput style={styles.input} value={form.city}
            onChangeText={v => set("city", v)} placeholder="City" placeholderTextColor={colors.inkSubtle} />
        </View>

        {/* Date */}
        <View style={styles.field}>
          <Text style={styles.label}>Preferred Date & Time</Text>
          <TextInput style={styles.input} value={form.scheduledAt} onChangeText={v => set("scheduledAt", v)}
            placeholder={Platform.OS === "ios" ? "YYYY-MM-DD HH:MM" : "2026-05-15 09:00"}
            placeholderTextColor={colors.inkSubtle} />
        </View>

        {/* Budget */}
        <View style={styles.row2}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Min Budget ($)</Text>
            <TextInput style={styles.input} value={form.budgetMin} onChangeText={v => set("budgetMin", v)}
              placeholder="50" placeholderTextColor={colors.inkSubtle} keyboardType="numeric" />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Max Budget ($)</Text>
            <TextInput style={styles.input} value={form.budgetMax} onChangeText={v => set("budgetMax", v)}
              placeholder="200" placeholderTextColor={colors.inkSubtle} keyboardType="numeric" />
          </View>
        </View>

        <View style={styles.hint}>
          <Ionicons name="information-circle" size={14} color={colors.inkSubtle} />
          <Text style={styles.hintText}>Handymen near you will be notified and can apply with a quote.</Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 56, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
  topTitle: { color: colors.white, fontWeight: "800", fontSize: fontSize.lg, flex: 1, textAlign: "center" },
  postBtn: { color: colors.skyBlue, fontWeight: "700", fontSize: fontSize.base },
  scroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: 60 },
  field: { gap: 6 },
  label: { color: "rgba(255,255,255,0.6)", fontSize: fontSize.sm, fontWeight: "600" },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.white, fontSize: fontSize.base },
  picker: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12 },
  pickerText: { color: colors.white, fontSize: fontSize.base },
  catList: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.md, overflow: "hidden" },
  catOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
  catOptionActive: { backgroundColor: colors.skyBlue + "15" },
  catText: { color: colors.white, fontSize: fontSize.sm },
  row2: { flexDirection: "row", gap: spacing.sm },
  gpsBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  gpsBtnText: { color: colors.skyBlue, fontSize: fontSize.xs, fontWeight: "600" },
  hint: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.cardBorder },
  hintText: { color: colors.inkSubtle, fontSize: fontSize.xs, flex: 1, lineHeight: 18 },
});

import { useState } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";

const CATEGORIES = [
  { value: "PLUMBING",        label: "Plumbing",        emoji: "🔧" },
  { value: "ELECTRICAL",      label: "Electrical",      emoji: "⚡" },
  { value: "CARPENTRY",       label: "Carpentry",       emoji: "🪚" },
  { value: "PAINTING",        label: "Painting",        emoji: "🎨" },
  { value: "CLEANING",        label: "Cleaning",        emoji: "🧹" },
  { value: "HVAC",            label: "HVAC",            emoji: "❄️" },
  { value: "ROOFING",         label: "Roofing",         emoji: "🏠" },
  { value: "LANDSCAPING",     label: "Landscaping",     emoji: "🌿" },
  { value: "MOVING",          label: "Moving",          emoji: "📦" },
  { value: "APPLIANCE_REPAIR",label: "Appliance Repair",emoji: "🔌" },
  { value: "GENERAL",         label: "General",         emoji: "🛠️" },
];

export default function PostJobScreen() {
  const [category,    setCategory]    = useState("");
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [address,     setAddress]     = useState("");
  const [city,        setCity]        = useState("");
  const [budgetMin,   setBudgetMin]   = useState("");
  const [budgetMax,   setBudgetMax]   = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);

  const reset = () => {
    setCategory(""); setTitle(""); setDescription(""); setAddress("");
    setCity(""); setBudgetMin(""); setBudgetMax(""); setScheduledAt("");
    setSubmitted(false);
  };

  const submit = async () => {
    if (!category || !title || !description || !address || !city || !budgetMin || !budgetMax || !scheduledAt) {
      Alert.alert("Missing Fields", "Please fill in all required fields.");
      return;
    }
    if (parseFloat(budgetMin) >= parseFloat(budgetMax)) {
      Alert.alert("Invalid Budget", "Max budget must be greater than min budget.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post("/job-requests", {
        category, title, description, address, city,
        budgetMin: parseFloat(budgetMin),
        budgetMax: parseFloat(budgetMax),
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Error", err.error ?? "Failed to post job. Try again.");
      }
    } catch {
      Alert.alert("Error", "Network error. Check your connection.");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.successBox}>
          <Text style={s.successEmoji}>✅</Text>
          <Text style={s.successTitle}>Job Posted!</Text>
          <Text style={s.successSub}>Nearby pros will be notified and can apply. We'll let you know when someone applies.</Text>
          <TouchableOpacity style={s.btn} onPress={reset}>
            <Text style={s.btnText}>Post Another Job</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.heading}>Post a Job</Text>
          <Text style={s.sub}>Describe what you need — matching pros will apply.</Text>

          {/* Category */}
          <Text style={s.label}>Category *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.value}
                style={[s.catChip, category === c.value && s.catChipActive]}
                onPress={() => setCategory(c.value)}
              >
                <Text style={s.catEmoji}>{c.emoji}</Text>
                <Text style={[s.catLabel, category === c.value && s.catLabelActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Title */}
          <Text style={s.label}>Job Title *</Text>
          <TextInput style={s.input} placeholderTextColor={C.slate500} placeholder="e.g. Fix leaking kitchen faucet"
            value={title} onChangeText={setTitle} />

          {/* Description */}
          <Text style={s.label}>Description *</Text>
          <TextInput style={[s.input, s.textArea]} placeholderTextColor={C.slate500}
            placeholder="Describe the job in detail — what needs to be done, any special requirements…"
            value={description} onChangeText={setDescription} multiline numberOfLines={4} />

          {/* Address */}
          <Text style={s.label}>Address *</Text>
          <TextInput style={s.input} placeholderTextColor={C.slate500} placeholder="Street address"
            value={address} onChangeText={setAddress} />

          {/* City */}
          <Text style={s.label}>City *</Text>
          <TextInput style={s.input} placeholderTextColor={C.slate500} placeholder="City"
            value={city} onChangeText={setCity} />

          {/* Budget */}
          <Text style={s.label}>Budget Range *</Text>
          <View style={s.row}>
            <TextInput style={[s.input, { flex: 1 }]} placeholderTextColor={C.slate500}
              placeholder="Min $" keyboardType="numeric" value={budgetMin} onChangeText={setBudgetMin} />
            <Text style={s.dash}>—</Text>
            <TextInput style={[s.input, { flex: 1 }]} placeholderTextColor={C.slate500}
              placeholder="Max $" keyboardType="numeric" value={budgetMax} onChangeText={setBudgetMax} />
          </View>

          {/* Scheduled Date */}
          <Text style={s.label}>Preferred Date *</Text>
          <TextInput style={s.input} placeholderTextColor={C.slate500} placeholder="YYYY-MM-DD"
            value={scheduledAt} onChangeText={setScheduledAt} />

          <TouchableOpacity style={[s.btn, submitting && s.btnDisabled]} onPress={submit} disabled={submitting}>
            {submitting
              ? <ActivityIndicator color={C.ink} />
              : <Text style={s.btnText}>Post Job →</Text>}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: C.ink },
  scroll:         { padding: 20 },
  heading:        { color: C.white, fontSize: 26, fontWeight: "900", marginBottom: 4 },
  sub:            { color: C.slate400, fontSize: 14, marginBottom: 20 },
  label:          { color: C.slate300, fontSize: 13, fontWeight: "700", marginBottom: 6, marginTop: 14 },
  input:          { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, color: C.white, fontSize: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  textArea:       { height: 100, textAlignVertical: "top" },
  catScroll:      { marginBottom: 4 },
  catChip:        { backgroundColor: "#1E293B", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, marginRight: 8, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  catChipActive:  { backgroundColor: C.sky + "22", borderColor: C.sky },
  catEmoji:       { fontSize: 18, marginBottom: 2 },
  catLabel:       { color: C.slate400, fontSize: 11, fontWeight: "600" },
  catLabelActive: { color: C.sky },
  row:            { flexDirection: "row", alignItems: "center", gap: 10 },
  dash:           { color: C.slate400, fontSize: 18 },
  btn:            { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 24 },
  btnDisabled:    { opacity: 0.5 },
  btnText:        { color: C.ink, fontWeight: "900", fontSize: 16 },
  successBox:     { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  successEmoji:   { fontSize: 64 },
  successTitle:   { color: C.white, fontSize: 28, fontWeight: "900" },
  successSub:     { color: C.slate400, fontSize: 15, textAlign: "center", lineHeight: 22 },
});

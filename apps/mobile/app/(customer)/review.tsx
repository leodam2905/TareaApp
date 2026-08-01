import { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";

const TIP_OPTIONS = [5, 10, 15, 20];

export default function ReviewScreen() {
  const { bookingId, handymanId, handymanName } = useLocalSearchParams<{
    bookingId: string; handymanId: string; handymanName: string;
  }>();
  const router = useRouter();

  const [rating, setRating]   = useState(0);
  const [comment, setComment] = useState("");
  const [tip, setTip]         = useState<number | null>(null);
  const [customTip, setCustomTip] = useState("");
  const [loading, setLoading] = useState(false);

  const finalTip = tip ?? (customTip ? Number(customTip) : null);

  const submit = async () => {
    if (rating === 0) { Alert.alert("Error", "Please select a star rating"); return; }
    setLoading(true);
    try {
      const rRes = await api.post("/reviews", { bookingId, rating, comment: comment.trim() || undefined });
      if (!rRes.ok) {
        const b = await rRes.json();
        Alert.alert("Error", b.error || "Could not submit review");
        setLoading(false);
        return;
      }
      if (finalTip && finalTip > 0) {
        await api.post("/stripe/tip", { bookingId, tipAmount: finalTip });
      }
      Alert.alert("Thank you!", "Your review has been submitted.", [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={s.backRow}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>

        <Text style={s.title}>Leave a Review</Text>
        <Text style={s.sub}>How was your experience with {handymanName}?</Text>

        {/* Star rating */}
        <View style={s.starsRow}>
          {[1, 2, 3, 4, 5].map(n => (
            <TouchableOpacity key={n} onPress={() => setRating(n)} style={s.starBtn}>
              <Text style={[s.star, n <= rating && s.starActive]}>{n <= rating ? "★" : "☆"}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.ratingLabel}>
          {rating === 0 ? "Tap to rate" : ["", "Poor", "Fair", "Good", "Great", "Excellent!"][rating]}
        </Text>

        {/* Comment */}
        <Text style={s.label}>Comment <Text style={s.opt}>(optional)</Text></Text>
        <TextInput
          style={s.textarea}
          value={comment}
          onChangeText={setComment}
          placeholder="Describe your experience…"
          placeholderTextColor={"#94A3B8"}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Tip */}
        <Text style={s.label}>Add a Tip <Text style={s.opt}>(optional)</Text></Text>
        <View style={s.tipRow}>
          {TIP_OPTIONS.map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tipBtn, tip === t && s.tipActive]}
              onPress={() => { setTip(tip === t ? null : t); setCustomTip(""); }}
            >
              <Text style={[s.tipText, tip === t && s.tipTextActive]}>${t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={s.input}
          value={customTip}
          onChangeText={v => { setCustomTip(v); setTip(null); }}
          placeholder="Custom amount ($)"
          placeholderTextColor={"#94A3B8"}
          keyboardType="numeric"
        />
        {finalTip != null && finalTip > 0 && (
          <Text style={s.tipPreview}>Tip: ${finalTip} will be added</Text>
        )}

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color={C.ink} /> : <Text style={s.btnText}>Submit Review</Text>}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#FFFFFF" },
  scroll:      { padding: 24 },
  backRow:     { marginBottom: 16 },
  back:        { color: C.sky, fontSize: 15, fontWeight: "600" },
  title:       { color: "#0F172A", fontSize: 26, fontWeight: "900", marginBottom: 4 },
  sub:         { color: "#64748B", fontSize: 14, marginBottom: 32 },
  starsRow:    { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 8 },
  starBtn:     { padding: 4 },
  star:        { fontSize: 44, color: C.slate600 },
  starActive:  { color: C.amber },
  ratingLabel: { textAlign: "center", color: "#64748B", fontSize: 14, marginBottom: 28 },
  label:       { color: "#64748B", fontSize: 13, fontWeight: "600", marginBottom: 8, marginTop: 16 },
  opt:         { color: "#94A3B8", fontWeight: "400" },
  textarea:    { backgroundColor: "#F1F5F9", borderRadius: 12, padding: 14, color: "#0F172A", fontSize: 15, height: 100, borderWidth: 1, borderColor: "#E2E8F0" },
  tipRow:      { flexDirection: "row", gap: 8, marginBottom: 10 },
  tipBtn:      { flex: 1, backgroundColor: "#F1F5F9", borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0" },
  tipActive:   { backgroundColor: "rgba(16,185,129,0.15)", borderColor: C.emerald },
  tipText:     { color: "#64748B", fontWeight: "700", fontSize: 15 },
  tipTextActive:{ color: C.emerald },
  input:       { backgroundColor: "#F1F5F9", borderRadius: 12, padding: 14, color: "#0F172A", fontSize: 15, borderWidth: 1, borderColor: "#E2E8F0" },
  tipPreview:  { color: C.emerald, fontSize: 13, fontWeight: "600", marginTop: 6 },
  btn:         { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 32 },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: C.ink, fontWeight: "900", fontSize: 16 },
});

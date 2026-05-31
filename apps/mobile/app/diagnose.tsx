import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Image, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { C } from "@/constants/colors";

const API = "https://taptarea.com/api";

const URGENCY = {
  urgent:  { label: "Urgent — Fix Today",   color: "#EF4444", bg: "rgba(239,68,68,0.12)"   },
  soon:    { label: "Fix Within a Week",     color: "#F59E0B", bg: "rgba(245,158,11,0.12)"  },
  routine: { label: "Schedule at Your Pace", color: "#10B981", bg: "rgba(16,185,129,0.12)"  },
};

const CATEGORY_LABEL: Record<string, string> = {
  PLUMBING: "Plumbing", ELECTRICAL: "Electrical", CARPENTRY: "Carpentry",
  PAINTING: "Painting", CLEANING: "Cleaning", HVAC: "HVAC",
  ROOFING: "Roofing", LANDSCAPING: "Landscaping", MOVING: "Moving",
  APPLIANCE_REPAIR: "Appliance Repair", GENERAL: "General",
};

type Diagnosis = {
  category: string;
  confidence: string;
  explanation: string;
  urgency: "urgent" | "soon" | "routine";
  tips: string[];
};

export default function DiagnoseScreen() {
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setBase64] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Diagnosis | null>(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission required", "Allow photo access to upload an image."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (!res.canceled && res.assets[0]) {
      setImageUri(res.assets[0].uri);
      setBase64(res.assets[0].base64 || null);
      setResult(null);
    }
  };

  const analyze = async () => {
    if (!imageBase64 && !description.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API}/ai/diagnose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mediaType: "image/jpeg", description }),
      });
      const data = await res.json();
      if (res.ok) setResult(data);
      else Alert.alert("Error", data.error || "Could not analyze. Try again.");
    } catch {
      Alert.alert("Error", "Network error. Check your connection.");
    }
    setLoading(false);
  };

  const urgency = result ? URGENCY[result.urgency] : null;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.heading}>Diagnose My Issue</Text>
        <Text style={s.sub}>Upload a photo or describe the problem — AI will tell you which pro you need.</Text>

        {/* Image picker */}
        <TouchableOpacity style={[s.imageBox, imageUri && { padding: 0 }]} onPress={pickImage} activeOpacity={0.8}>
          {imageUri
            ? <Image source={{ uri: imageUri }} style={s.imagePreview} resizeMode="cover" />
            : <>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📷</Text>
                <Text style={s.imageBoxText}>Tap to upload a photo</Text>
                <Text style={s.imageBoxSub}>Optional but recommended</Text>
              </>
          }
        </TouchableOpacity>

        {/* Description */}
        <Text style={s.label}>Or describe the issue</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. Water stain on ceiling after heavy rain…"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />

        {/* Analyze button */}
        <TouchableOpacity
          style={[s.btn, (!imageBase64 && !description.trim()) && s.btnDisabled]}
          onPress={analyze}
          disabled={loading || (!imageBase64 && !description.trim())}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>✨  Diagnose My Issue</Text>
          }
        </TouchableOpacity>

        {/* Result */}
        {result && urgency && (
          <View style={s.resultCard}>
            <Text style={s.resultBadge}>AI Diagnosis</Text>

            {/* Category */}
            <Text style={s.resultCategory}>
              {CATEGORY_LABEL[result.category] || result.category} Pro
            </Text>

            {/* Urgency */}
            <View style={[s.urgencyBadge, { backgroundColor: urgency.bg }]}>
              <Text style={[s.urgencyText, { color: urgency.color }]}>{urgency.label}</Text>
            </View>

            {/* Explanation */}
            <Text style={s.explanation}>{result.explanation}</Text>

            {/* Tips */}
            <Text style={s.tipsLabel}>💡 While you wait</Text>
            {result.tips.map((tip, i) => (
              <View key={i} style={s.tipRow}>
                <View style={s.tipNum}><Text style={s.tipNumText}>{i + 1}</Text></View>
                <Text style={s.tipText}>{tip}</Text>
              </View>
            ))}

            {/* Book CTA */}
            <TouchableOpacity
              style={s.bookBtn}
              onPress={() => router.push({ pathname: "/(auth)/register" as any, params: { role: "CUSTOMER" } })}
            >
              <Text style={s.bookBtnText}>Sign Up & Book a {CATEGORY_LABEL[result.category] || "Pro"} →</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: C.ink },
  scroll:         { padding: 20 },
  back:           { marginBottom: 16 },
  backText:       { color: C.sky, fontSize: 15, fontWeight: "600" },
  heading:        { color: "#fff", fontSize: 28, fontWeight: "900", marginBottom: 6 },
  sub:            { color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 20, marginBottom: 24 },
  imageBox:       { borderWidth: 2, borderColor: "rgba(255,255,255,0.15)", borderStyle: "dashed", borderRadius: 16, padding: 32, alignItems: "center", marginBottom: 20, overflow: "hidden" },
  imagePreview:   { width: "100%", height: 200, borderRadius: 14 },
  imageBoxText:   { color: C.sky, fontWeight: "700", fontSize: 15 },
  imageBoxSub:    { color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 4 },
  label:          { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "700", marginBottom: 8 },
  input:          { backgroundColor: "#1E293B", borderRadius: 14, padding: 14, color: "#fff", fontSize: 14, minHeight: 80, textAlignVertical: "top", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginBottom: 20 },
  btn:            { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginBottom: 28 },
  btnDisabled:    { opacity: 0.4 },
  btnText:        { color: C.ink, fontWeight: "900", fontSize: 16 },
  resultCard:     { backgroundColor: "#1E293B", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "rgba(56,189,248,0.3)", gap: 12 },
  resultBadge:    { color: C.sky, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  resultCategory: { color: "#fff", fontSize: 26, fontWeight: "900" },
  urgencyBadge:   { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, alignSelf: "flex-start" },
  urgencyText:    { fontSize: 13, fontWeight: "700" },
  explanation:    { color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 22 },
  tipsLabel:      { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  tipRow:         { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  tipNum:         { width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(56,189,248,0.2)", alignItems: "center", justifyContent: "center", marginTop: 1 },
  tipNumText:     { color: C.sky, fontSize: 11, fontWeight: "900" },
  tipText:        { color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 20, flex: 1 },
  bookBtn:        { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  bookBtnText:    { color: C.ink, fontWeight: "900", fontSize: 15 },
});

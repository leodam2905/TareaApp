import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Image, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { C } from "@/constants/colors";

const API = "https://taptarea.com/api";

const URGENCY = {
  urgent:  { label: "Urgent — Fix Today",   color: "#EF4444", bg: "rgba(239,68,68,0.1)",   icon: "🚨" },
  soon:    { label: "Fix Within a Week",     color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  icon: "⚠️" },
  routine: { label: "No Rush — Plan Ahead", color: "#10B981", bg: "rgba(16,185,129,0.1)",  icon: "✅" },
};

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  PLUMBING:        { label: "Plumbing",         icon: "🔧", color: "#38BDF8" },
  ELECTRICAL:      { label: "Electrical",       icon: "⚡", color: "#F59E0B" },
  CARPENTRY:       { label: "Carpentry",        icon: "🪵", color: "#D97706" },
  PAINTING:        { label: "Painting",         icon: "🎨", color: "#A78BFA" },
  CLEANING:        { label: "Cleaning",         icon: "✨", color: "#34D399" },
  HVAC:            { label: "HVAC",             icon: "❄️", color: "#7DD3FC" },
  ROOFING:         { label: "Roofing",          icon: "🏠", color: "#94A3B8" },
  LANDSCAPING:     { label: "Landscaping",      icon: "🌿", color: "#4ADE80" },
  MOVING:          { label: "Moving",           icon: "📦", color: "#FB923C" },
  APPLIANCE_REPAIR:{ label: "Appliance Repair", icon: "🔌", color: "#818CF8" },
  GENERAL:         { label: "General",          icon: "🛠️", color: "#94A3B8" },
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
  const [imageUri,     setImageUri]  = useState<string | null>(null);
  const [imageBase64,  setBase64]    = useState<string | null>(null);
  const [description,  setDesc]      = useState("");
  const [loading,      setLoading]   = useState(false);
  const [result,       setResult]    = useState<Diagnosis | null>(null);

  const pulse  = useRef(new Animated.Value(1)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.05, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.setValue(1);
    }
  }, [loading]);

  useEffect(() => {
    if (result) {
      fadeIn.setValue(0);
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, [result]);

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
  const catMeta = result
    ? (CATEGORY_META[result.category] ?? { label: result.category, icon: "🛠️", color: C.sky })
    : null;
  const canAnalyze = !loading && (!!imageBase64 || description.trim().length > 0);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Nav */}
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroRing}>
            <Text style={s.heroEmoji}>🔍</Text>
          </View>
          <Text style={s.heading}>What's the problem?</Text>
          <Text style={s.sub}>Show us a photo or describe the issue — we'll tell you exactly which pro you need.</Text>
        </View>

        {/* Photo upload */}
        <TouchableOpacity style={[s.imageBox, imageUri && s.imageBoxFilled]} onPress={pickImage} activeOpacity={0.85}>
          {imageUri ? (
            <>
              <Image source={{ uri: imageUri }} style={s.imagePreview} resizeMode="cover" />
              <View style={s.cornerTL} /><View style={s.cornerTR} />
              <View style={s.cornerBL} /><View style={s.cornerBR} />
              <View style={s.retapeBanner}><Text style={s.retapeText}>Tap to change photo</Text></View>
            </>
          ) : (
            <View style={s.imagePlaceholder}>
              <View style={s.cameraRing}><Text style={{ fontSize: 30 }}>📷</Text></View>
              <Text style={s.imageTitle}>Upload a photo</Text>
              <Text style={s.imageSub}>Tap to browse your library</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Or divider */}
        <View style={s.orRow}>
          <View style={s.orLine} /><Text style={s.orText}>or describe the issue</Text><View style={s.orLine} />
        </View>

        {/* Description */}
        <TextInput
          style={s.input}
          placeholder="e.g. Water stain on ceiling after heavy rain…"
          placeholderTextColor="rgba(255,255,255,0.22)"
          value={description}
          onChangeText={setDesc}
          multiline
          numberOfLines={4}
        />

        {/* CTA */}
        <Animated.View style={{ transform: [{ scale: loading ? pulse : 1 }] }}>
          <TouchableOpacity
            style={[s.btn, !canAnalyze && s.btnOff]}
            onPress={analyze}
            disabled={!canAnalyze}
            activeOpacity={0.85}
          >
            {loading ? (
              <View style={s.btnRow}>
                <Text style={s.btnDot}>●</Text>
                <Text style={s.btnText}>Analyzing your issue…</Text>
              </View>
            ) : (
              <View style={s.btnRow}>
                <Text style={{ fontSize: 18, marginRight: 8 }}>✨</Text>
                <Text style={s.btnText}>Diagnose My Issue</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Result */}
        {result && urgency && catMeta && (
          <Animated.View style={[s.resultCard, { opacity: fadeIn }]}>

            {/* Category header */}
            <View style={[s.catHeader, { backgroundColor: catMeta.color + "15" }]}>
              <Text style={s.catEmoji}>{catMeta.icon}</Text>
              <View style={s.catText}>
                <Text style={s.catEyebrow}>You need a</Text>
                <Text style={[s.catName, { color: catMeta.color }]}>{catMeta.label} Pro</Text>
              </View>
            </View>

            <View style={s.cardBody}>
              {/* Urgency pill */}
              <View style={[s.urgencyPill, { backgroundColor: urgency.bg, borderLeftColor: urgency.color }]}>
                <Text style={{ fontSize: 15, marginRight: 8 }}>{urgency.icon}</Text>
                <Text style={[s.urgencyText, { color: urgency.color }]}>{urgency.label}</Text>
              </View>

              {/* Assessment */}
              <Text style={s.sectionLabel}>Assessment</Text>
              <Text style={s.explanation}>{result.explanation}</Text>

              <View style={s.sep} />

              {/* Tips */}
              <Text style={s.sectionLabel}>Quick tips while you wait</Text>
              {result.tips.map((tip, i) => (
                <View key={i} style={s.tipRow}>
                  <View style={s.tipArrow}><Text style={s.tipArrowText}>›</Text></View>
                  <Text style={s.tipText}>{tip}</Text>
                </View>
              ))}

              {/* CTA */}
              <TouchableOpacity
                style={s.bookBtn}
                onPress={() => router.push({ pathname: "/(auth)/register" as any, params: { role: "CUSTOMER" } })}
                activeOpacity={0.85}
              >
                <Text style={s.bookBtnText}>Book a {catMeta.label} Pro  →</Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const CORNER_SIZE = 18;

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: C.ink },
  scroll:          { padding: 20 },
  back:            { marginBottom: 24 },
  backText:        { color: C.sky, fontSize: 15, fontWeight: "600" },

  // Hero
  hero:            { alignItems: "center", marginBottom: 28 },
  heroRing:        { width: 76, height: 76, borderRadius: 38, backgroundColor: "rgba(56,189,248,0.08)", borderWidth: 1.5, borderColor: "rgba(56,189,248,0.25)", alignItems: "center", justifyContent: "center", marginBottom: 18 },
  heroEmoji:       { fontSize: 34 },
  heading:         { color: "#fff", fontSize: 26, fontWeight: "900", textAlign: "center", marginBottom: 10 },
  sub:             { color: "rgba(255,255,255,0.42)", fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 300 },

  // Image box
  imageBox:        { borderWidth: 1.5, borderColor: "rgba(56,189,248,0.18)", borderStyle: "dashed", borderRadius: 20, overflow: "hidden", marginBottom: 22, backgroundColor: "rgba(56,189,248,0.03)", minHeight: 160 },
  imageBoxFilled:  { borderStyle: "solid", borderColor: "rgba(56,189,248,0.35)" },
  imagePlaceholder:{ alignItems: "center", paddingVertical: 36 },
  cameraRing:      { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(56,189,248,0.1)", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  imageTitle:      { color: "#fff", fontWeight: "700", fontSize: 15, marginBottom: 5 },
  imageSub:        { color: "rgba(255,255,255,0.28)", fontSize: 12 },
  imagePreview:    { width: "100%", height: 220 },
  // scan corners
  cornerTL:        { position: "absolute", top: 8, left: 8,   width: CORNER_SIZE, height: CORNER_SIZE, borderTopWidth: 2.5, borderLeftWidth: 2.5,   borderColor: C.sky, borderTopLeftRadius: 4 },
  cornerTR:        { position: "absolute", top: 8, right: 8,  width: CORNER_SIZE, height: CORNER_SIZE, borderTopWidth: 2.5, borderRightWidth: 2.5,  borderColor: C.sky, borderTopRightRadius: 4 },
  cornerBL:        { position: "absolute", bottom: 36, left: 8,  width: CORNER_SIZE, height: CORNER_SIZE, borderBottomWidth: 2.5, borderLeftWidth: 2.5,  borderColor: C.sky, borderBottomLeftRadius: 4 },
  cornerBR:        { position: "absolute", bottom: 36, right: 8, width: CORNER_SIZE, height: CORNER_SIZE, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderColor: C.sky, borderBottomRightRadius: 4 },
  retapeBanner:    { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(15,23,42,0.72)", paddingVertical: 9, alignItems: "center" },
  retapeText:      { color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "600" },

  // Divider
  orRow:           { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  orLine:          { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.07)" },
  orText:          { color: "rgba(255,255,255,0.28)", fontSize: 12, marginHorizontal: 14 },

  // Input
  input:           { backgroundColor: "#1E293B", borderRadius: 14, padding: 14, color: "#fff", fontSize: 14, minHeight: 90, textAlignVertical: "top", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", marginBottom: 20 },

  // Button
  btn:             { backgroundColor: C.sky, borderRadius: 16, paddingVertical: 18, alignItems: "center", marginBottom: 30 },
  btnOff:          { opacity: 0.3 },
  btnRow:          { flexDirection: "row", alignItems: "center" },
  btnDot:          { color: C.ink, fontSize: 10, marginRight: 10, opacity: 0.7 },
  btnText:         { color: C.ink, fontWeight: "900", fontSize: 16, letterSpacing: 0.3 },

  // Result card
  resultCard:      { borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },

  catHeader:       { flexDirection: "row", alignItems: "center", padding: 20, gap: 16 },
  catEmoji:        { fontSize: 44 },
  catText:         { flex: 1 },
  catEyebrow:      { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 },
  catName:         { fontSize: 24, fontWeight: "900" },

  cardBody:        { backgroundColor: "#1E293B", padding: 20, gap: 14 },

  urgencyPill:     { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderLeftWidth: 3 },
  urgencyText:     { fontWeight: "700", fontSize: 14 },

  sectionLabel:    { color: "rgba(255,255,255,0.32)", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.4 },
  explanation:     { color: "rgba(255,255,255,0.78)", fontSize: 14, lineHeight: 23 },

  sep:             { height: 1, backgroundColor: "rgba(255,255,255,0.07)" },

  tipRow:          { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  tipArrow:        { width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(56,189,248,0.15)", alignItems: "center", justifyContent: "center", marginTop: 1 },
  tipArrowText:    { color: C.sky, fontSize: 15, fontWeight: "900", lineHeight: 20 },
  tipText:         { color: "rgba(255,255,255,0.62)", fontSize: 13, lineHeight: 21, flex: 1 },

  bookBtn:         { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 4 },
  bookBtnText:     { color: C.ink, fontWeight: "900", fontSize: 15, letterSpacing: 0.3 },
});

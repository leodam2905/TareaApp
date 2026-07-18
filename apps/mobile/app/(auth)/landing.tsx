import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Image, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import Constants from "expo-constants";
import { API_BASE } from "@/lib/api";
import { saveToken, saveRole } from "@/lib/storage";
import { C } from "@/constants/colors";

const IS_HANDYMAN = (Constants.expoConfig?.extra?.appVariant ?? "customer") === "handyman";
const { height } = Dimensions.get("window");

// ── Palette for the light Pro landing ───────────────────────────────────────
const BLUE = "#2563EB";
const INK  = "#0F172A";
const GRAY = "#64748B";
const LINE = "#E2E8F0";
const SOFT = "#F1F5F9";

const STEPS = [
  { icon: "👤", n: "1", title: "Create your profile", desc: "Add your skills, photos and service areas." },
  { icon: "📋", n: "2", title: "Get job requests",   desc: "We'll send jobs that match your skills and availability." },
  { icon: "✅", n: "3", title: "Do great work",       desc: "Complete the job, get paid and build happy clients." },
];

const TRUST = [
  { icon: "🛡️", label: "Background\nverified pros" },
  { icon: "🎧", label: "24/7\nsupport" },
  { icon: "🔒", label: "Safe &\nsecure" },
];

export default function LandingScreen() {
  return IS_HANDYMAN ? <ProLanding /> : <CustomerLanding />;
}

// ════════════════════════ PRO (handyman) LANDING ════════════════════════════
function ProLanding() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading]   = useState(false);

  const login = async () => {
    if (!email.trim() || !password) { Alert.alert("Error", "Please enter your email and password"); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) { Alert.alert("Login failed", data.error || "Invalid credentials"); return; }
      if (data.requiresOtp) {
        router.push({ pathname: "/(auth)/verify-otp", params: { pendingToken: data.pendingToken, phoneMask: data.phoneMask ?? "" } });
        return;
      }
      await saveToken(data.token);
      await saveRole(data.role);
      router.replace(data.role === "HANDYMAN" ? "/(handyman)/tabs/dashboard" : "/(handyman)/become-pro" as any);
    } catch {
      Alert.alert("Error", "Could not connect. Check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={p.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={p.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Header */}
            <View style={p.header}>
              <View style={p.brandRow}>
                <Image source={require("../../assets/splash-logo.png")} style={p.logo} resizeMode="contain" />
                <Text style={p.brand}>Tarea</Text>
              </View>
              <View style={p.verifiedPill}>
                <Text style={p.verifiedText}>🛡️ Verified Pros</Text>
              </View>
            </View>

            {/* Hero */}
            <View style={p.hero}>
              <View style={p.heroText}>
                <Text style={p.h1}>
                  Join Tarea and <Text style={p.h1Blue}>get local jobs, fast payouts</Text> and build your <Text style={p.h1Blue}>reputation.</Text>
                </Text>
                <Text style={p.sub}>More jobs. Fair pay. Real growth. All in one place for pros like you.</Text>
              </View>
              <Image source={require("../../assets/pro-hero.png")} style={p.heroImg} resizeMode="cover" />
            </View>

            <TouchableOpacity style={p.ctaBtn} onPress={() => router.push("/(auth)/register" as any)} activeOpacity={0.9}>
              <Text style={p.ctaText}>Join Tarea as a Pro  →</Text>
            </TouchableOpacity>

            {/* How it works */}
            <Text style={p.sectionTitle}>How it works</Text>
            <View style={p.steps}>
              {STEPS.map(st => (
                <View key={st.n} style={p.step}>
                  <View style={p.stepIcon}><Text style={{ fontSize: 22 }}>{st.icon}</Text></View>
                  <View style={p.stepNum}><Text style={p.stepNumText}>{st.n}</Text></View>
                  <Text style={p.stepTitle}>{st.title}</Text>
                  <Text style={p.stepDesc}>{st.desc}</Text>
                </View>
              ))}
            </View>

            {/* Login card */}
            <View style={p.card}>
              <View style={p.field}>
                <Text style={p.fieldIcon}>✉️</Text>
                <TextInput style={p.input} value={email} onChangeText={setEmail}
                  placeholder="Email address" placeholderTextColor={GRAY}
                  autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
              </View>
              <View style={p.field}>
                <Text style={p.fieldIcon}>🔒</Text>
                <TextInput style={p.input} value={password} onChangeText={setPassword}
                  placeholder="Password" placeholderTextColor={GRAY}
                  secureTextEntry={!showPw} autoComplete="password" />
                <TouchableOpacity onPress={() => setShowPw(v => !v)} hitSlop={10}>
                  <Text style={p.eye}>{showPw ? "🙈" : "👁️"}</Text>
                </TouchableOpacity>
              </View>

              <View style={p.rowBetween}>
                <TouchableOpacity style={p.remember} onPress={() => setRemember(v => !v)}>
                  <View style={[p.checkbox, remember && p.checkboxOn]}>{remember && <Text style={p.checkTick}>✓</Text>}</View>
                  <Text style={p.rememberText}>Remember me</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password" as any)}>
                  <Text style={p.forgot}>Forgot password?</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[p.loginBtn, loading && { opacity: 0.6 }]} onPress={login} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={p.loginText}>Log in</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={p.signup} onPress={() => router.push("/(auth)/register" as any)}>
                <Text style={p.signupText}>Don't have an account? <Text style={p.signupBold}>Sign up</Text></Text>
              </TouchableOpacity>
            </View>

            {/* Trust bar */}
            <View style={p.trust}>
              {TRUST.map((t, i) => (
                <View key={t.label} style={[p.trustItem, i < TRUST.length - 1 && p.trustDivider]}>
                  <Text style={p.trustIcon}>{t.icon}</Text>
                  <Text style={p.trustLabel}>{t.label}</Text>
                </View>
              ))}
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const p = StyleSheet.create({
  root:         { flex: 1, backgroundColor: "#FFFFFF" },
  scroll:       { paddingHorizontal: 20, paddingBottom: 28 },

  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 8, paddingBottom: 8 },
  brandRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
  logo:         { width: 40, height: 40 },
  brand:        { fontSize: 26, fontWeight: "900", color: INK, letterSpacing: -1 },
  verifiedPill: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#BFD3F5", backgroundColor: "#EFF5FF", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  verifiedText: { color: BLUE, fontWeight: "700", fontSize: 13 },

  hero:         { flexDirection: "row", marginTop: 12, gap: 8 },
  heroText:     { flex: 1, paddingTop: 6 },
  h1:           { fontSize: 30, fontWeight: "900", color: INK, lineHeight: 36, letterSpacing: -0.5 },
  h1Blue:       { color: BLUE },
  sub:          { color: GRAY, fontSize: 15, lineHeight: 22, marginTop: 14 },
  heroImg:      { width: 150, height: 265, borderRadius: 16, alignSelf: "flex-start" },

  ctaBtn:       { backgroundColor: BLUE, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 18 },
  ctaText:      { color: "#fff", fontSize: 16, fontWeight: "800" },

  sectionTitle: { fontSize: 20, fontWeight: "800", color: INK, marginTop: 30, marginBottom: 16 },
  steps:        { flexDirection: "row", gap: 8 },
  step:         { flex: 1, alignItems: "center" },
  stepIcon:     { width: 56, height: 56, borderRadius: 28, backgroundColor: SOFT, alignItems: "center", justifyContent: "center" },
  stepNum:      { width: 22, height: 22, borderRadius: 11, backgroundColor: BLUE, alignItems: "center", justifyContent: "center", marginTop: -11, marginBottom: 6, borderWidth: 2, borderColor: "#fff" },
  stepNumText:  { color: "#fff", fontWeight: "800", fontSize: 12 },
  stepTitle:    { color: INK, fontWeight: "800", fontSize: 13, textAlign: "center", marginBottom: 4 },
  stepDesc:     { color: GRAY, fontSize: 12, textAlign: "center", lineHeight: 16 },

  card:         { borderWidth: 1, borderColor: LINE, borderRadius: 18, padding: 18, marginTop: 28, gap: 4 },
  field:        { flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 12 },
  fieldIcon:    { fontSize: 16, width: 22, textAlign: "center" },
  input:        { flex: 1, color: INK, fontSize: 15 },
  eye:          { fontSize: 16 },
  rowBetween:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, marginBottom: 4 },
  remember:     { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox:     { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },
  checkboxOn:   { backgroundColor: BLUE, borderColor: BLUE },
  checkTick:    { color: "#fff", fontSize: 11, fontWeight: "900" },
  rememberText: { color: GRAY, fontSize: 13 },
  forgot:       { color: BLUE, fontSize: 13, fontWeight: "600" },
  loginBtn:     { backgroundColor: BLUE, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 14 },
  loginText:    { color: "#fff", fontSize: 16, fontWeight: "800" },
  signup:       { alignItems: "center", marginTop: 14 },
  signupText:   { color: GRAY, fontSize: 14 },
  signupBold:   { color: BLUE, fontWeight: "800" },

  trust:        { flexDirection: "row", backgroundColor: SOFT, borderRadius: 16, marginTop: 20, paddingVertical: 14 },
  trustItem:    { flex: 1, alignItems: "center", gap: 6, paddingHorizontal: 4 },
  trustDivider: { borderRightWidth: 1, borderRightColor: LINE },
  trustIcon:    { fontSize: 20 },
  trustLabel:   { color: GRAY, fontSize: 12, fontWeight: "600", textAlign: "center", lineHeight: 15 },
});

// ════════════════════════ CUSTOMER LANDING (unchanged) ══════════════════════
const VIDEO_URL = "https://pub-adf5c223fa884cf6878a12b8f1ef7d2f.r2.dev/hero/hero-mobile.mp4";
const FEATURES = [
  { emoji: "🔍", color: "#0EA5E9", title: "Find Verified Pros",  desc: "Browse background-checked handymen near you" },
  { emoji: "📅", color: "#22C55E", title: "Book in Seconds",      desc: "Schedule same-day or in advance, pay securely" },
  { emoji: "⭐", color: "#F97316", title: "Quality Guaranteed",   desc: "Live job tracking, reviews, and dispute protection" },
];
const TOOLS = [
  { emoji: "🔍", color: "#3B82F6", title: "Diagnose Issue",  desc: "AI identifies what pro you need",   route: "/diagnose"       },
  { emoji: "⚡", color: "#F59E0B", title: "Instant Quote",   desc: "Get a price before you book",        route: "/instant-quote"  },
];

function CustomerLanding() {
  const router = useRouter();
  const player = useVideoPlayer(VIDEO_URL, pl => { pl.loop = true; pl.muted = true; pl.play(); });
  return (
    <View style={s.root}>
      <VideoView player={player} style={s.video} contentFit="cover" nativeControls={false} />
      <View style={s.overlay} />
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.hero}>
            <Image source={require("../../assets/tarea-logo-white.png")} style={s.logoImg} resizeMode="contain" />
            <Text style={s.tagline}>Your trusted home service pros</Text>
          </View>
          <View style={s.features}>
            {FEATURES.map(f => (
              <View key={f.title} style={s.featureRow}>
                <View style={[s.featureIcon, { backgroundColor: `${f.color}25`, borderColor: `${f.color}55` }]}>
                  <Text style={s.featureEmoji}>{f.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.featureTitle}>{f.title}</Text>
                  <Text style={s.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={s.toolsRow}>
            {TOOLS.map(t => (
              <TouchableOpacity key={t.title} style={s.toolCard} onPress={() => router.push(t.route as any)} activeOpacity={0.85}>
                <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: `${t.color}25`, borderWidth: 2, borderColor: `${t.color}55`, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 24 }}>{t.emoji}</Text>
                </View>
                <Text style={s.toolTitle}>{t.title}</Text>
                <Text style={s.toolDesc}>{t.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.ctas}>
            <TouchableOpacity style={s.btnPrimary} onPress={() => router.push("/(auth)/register" as any)}>
              <Text style={s.btnPrimaryText}>Find a Pro</Text>
              <Text style={s.btnPrimarySubtext}>I need home services</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.signIn} onPress={() => router.push("/(auth)/login" as any)}>
            <Text style={s.signInText}>Already have an account? <Text style={s.signInBold}>Sign in</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root:               { flex: 1, backgroundColor: "#0F172A" },
  video:              { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  overlay:            { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15,23,42,0.58)" },
  safe:               { flex: 1 },
  scroll:             { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40, minHeight: height },
  hero:               { alignItems: "center", paddingTop: 60, paddingBottom: 48 },
  logoImg:            { width: 236, height: 107, marginBottom: 14 },
  tagline:            { color: "rgba(255,255,255,0.7)", fontSize: 16, marginTop: 8, textAlign: "center" },
  features:           { gap: 16, marginBottom: 48 },
  featureRow:         { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: "rgba(30,41,59,0.75)", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  featureIcon:        { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  featureEmoji:       { fontSize: 22 },
  featureTitle:       { color: C.white, fontSize: 15, fontWeight: "700", marginBottom: 3 },
  featureDesc:        { color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 18 },
  ctas:               { gap: 12, marginBottom: 28 },
  btnPrimary:         { backgroundColor: C.sky, borderRadius: 18, paddingVertical: 18, alignItems: "center" },
  btnPrimaryText:     { color: C.ink, fontSize: 18, fontWeight: "900" },
  btnPrimarySubtext:  { color: "rgba(15,23,42,0.6)", fontSize: 12, marginTop: 3, fontWeight: "600" },
  signIn:             { alignItems: "center" },
  signInText:         { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  signInBold:         { color: C.sky, fontWeight: "700" },
  toolsRow:           { flexDirection: "row", gap: 12, marginBottom: 24 },
  toolCard:           { flex: 1, backgroundColor: "rgba(30,41,59,0.85)", borderRadius: 18, padding: 16, alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(56,189,248,0.2)" },
  toolTitle:          { color: "#fff", fontSize: 13, fontWeight: "800", textAlign: "center" },
  toolDesc:           { color: "rgba(255,255,255,0.45)", fontSize: 11, textAlign: "center", lineHeight: 15 },
});

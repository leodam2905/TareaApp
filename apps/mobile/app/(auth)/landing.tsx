import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Image, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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
  { icon: "person-outline",           n: "1", title: "Create your profile", desc: "Add your skills, photos and service areas." },
  { icon: "list-outline",             n: "2", title: "Get job requests",    desc: "We'll send jobs that match your skills and availability." },
  { icon: "checkmark-circle-outline", n: "3", title: "Do great work",       desc: "Complete the job, get paid and build happy clients." },
] as const;

const TRUST = [
  { icon: "shield-checkmark-outline", label: "Background\nverified pros" },
  { icon: "headset-outline",          label: "24/7\nsupport" },
  { icon: "lock-closed-outline",      label: "Safe &\nsecure" },
] as const;

export default function LandingScreen() {
  return IS_HANDYMAN ? <ProLanding /> : <CustomerLanding />;
}

// ════════════════════════ PRO (handyman) LANDING ════════════════════════════
function ProLanding() {
  const router = useRouter();

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
                <Ionicons name="shield-checkmark-outline" size={15} color={BLUE} />
                <Text style={p.verifiedText}>Verified Pros</Text>
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
            <TouchableOpacity style={p.loginOutline} onPress={() => router.push("/(auth)/login" as any)} activeOpacity={0.9}>
              <Text style={p.loginOutlineText}>Log in</Text>
            </TouchableOpacity>

            {/* How it works */}
            <Text style={p.sectionTitle}>How it works</Text>
            <View style={p.steps}>
              {STEPS.map(st => (
                <View key={st.n} style={p.step}>
                  <View style={p.stepIcon}><Ionicons name={st.icon} size={26} color={BLUE} /></View>
                  <View style={p.stepNum}><Text style={p.stepNumText}>{st.n}</Text></View>
                  <Text style={p.stepTitle}>{st.title}</Text>
                  <Text style={p.stepDesc}>{st.desc}</Text>
                </View>
              ))}
            </View>

            {/* Trust bar */}
            <View style={p.trust}>
              {TRUST.map((t, i) => (
                <View key={t.label} style={[p.trustItem, i < TRUST.length - 1 && p.trustDivider]}>
                  <Ionicons name={t.icon} size={22} color="#475569" />
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
  verifiedPill: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "#BFD3F5", backgroundColor: "#EFF5FF", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  verifiedText: { color: BLUE, fontWeight: "700", fontSize: 13 },

  hero:         { flexDirection: "row", marginTop: 12, gap: 8 },
  heroText:     { flex: 1, paddingTop: 6 },
  h1:           { fontSize: 30, fontWeight: "900", color: INK, lineHeight: 36, letterSpacing: -0.5 },
  h1Blue:       { color: BLUE },
  sub:          { color: GRAY, fontSize: 15, lineHeight: 22, marginTop: 14 },
  heroImg:      { width: 150, height: 265, borderRadius: 16, alignSelf: "flex-start" },

  ctaBtn:       { backgroundColor: BLUE, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 18 },
  ctaText:      { color: "#fff", fontSize: 16, fontWeight: "800" },
  loginOutline: { borderWidth: 1.5, borderColor: BLUE, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 10 },
  loginOutlineText: { color: BLUE, fontSize: 16, fontWeight: "800" },

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

// ════════════════════════ CUSTOMER LANDING (light) ══════════════════════════
const FEATURES: { icon: React.ComponentProps<typeof Ionicons>["name"]; color: string; title: string; desc: string; route?: string }[] = [
  { icon: "shield-checkmark-outline", color: "#2563EB", title: "Verified Professionals",  desc: "Background-checked and reviewed pros." },
  { icon: "time-outline",             color: "#2563EB", title: "Fast & Easy Booking",     desc: "Book in minutes and get matched quickly." },
  { icon: "card-outline",             color: "#2563EB", title: "Upfront Pricing",         desc: "Clear, transparent pricing always." },
  { icon: "sparkles-outline",         color: "#10B981", title: "Diagnose Issue",          desc: "AI identifies what you need.", route: "/diagnose" },
  { icon: "pricetag-outline",         color: "#7C3AED", title: "Instant Quote",           desc: "Get a price before you book.", route: "/instant-quote" },
  { icon: "thumbs-up-outline",        color: "#F97316", title: "Satisfaction Guaranteed", desc: "We're not happy until you're happy." },
];

function CustomerLanding() {
  const router = useRouter();
  return (
    <View style={cs.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={cs.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={cs.header}>
            <View style={cs.brandRow}>
              <Image source={require("../../assets/tarea-home-mark.png")} style={cs.logo} resizeMode="contain" />
              <Text style={cs.brand}>Tarea</Text>
            </View>
            <View style={cs.pill}>
              <Ionicons name="shield-checkmark-outline" size={18} color={BLUE} />
              <Text style={cs.pillText}>Trusted Pros{"\n"}In Your Area</Text>
            </View>
          </View>

          {/* Heading */}
          <Text style={cs.h1}>Reliable help for every job <Text style={cs.h1Blue}>around your home.</Text></Text>
          <Text style={cs.sub}>Book trusted handymen for home repairs, installations, cleaning and more in minutes.</Text>

          {/* Illustration */}
          <Image source={require("../../assets/landing-house.png")} style={cs.house} resizeMode="contain" />

          {/* Features + CTAs */}
          <View style={cs.card}>
            <View style={cs.grid}>
              {FEATURES.map(f => {
                const inner = (
                  <>
                    <View style={[cs.featIcon, { backgroundColor: f.color + "1A" }]}><Ionicons name={f.icon} size={22} color={f.color} /></View>
                    <Text style={cs.featTitle}>{f.title}</Text>
                    <Text style={cs.featDesc}>{f.desc}</Text>
                  </>
                );
                return f.route
                  ? <TouchableOpacity key={f.title} style={cs.feat} activeOpacity={0.8} onPress={() => router.push(f.route as any)}>{inner}</TouchableOpacity>
                  : <View key={f.title} style={cs.feat}>{inner}</View>;
              })}
            </View>

            <TouchableOpacity style={cs.cta} activeOpacity={0.9} onPress={() => router.push("/(auth)/register" as any)}>
              <Text style={cs.ctaText}>Get Started</Text>
              <View style={cs.ctaArrow}><Ionicons name="arrow-forward" size={18} color={BLUE} /></View>
            </TouchableOpacity>
            <TouchableOpacity style={cs.loginBtn} activeOpacity={0.9} onPress={() => router.push("/(auth)/login" as any)}>
              <Text style={cs.loginText}>I already have an account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const cs = StyleSheet.create({
  root:       { flex: 1, backgroundColor: "#FFFFFF" },
  scroll:     { paddingHorizontal: 20, paddingBottom: 32 },
  header:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 8, marginBottom: 18 },
  brandRow:   { flexDirection: "row", alignItems: "center", gap: 8 },
  logo:       { width: 36, height: 36, borderRadius: 9 },
  brand:      { fontSize: 26, fontWeight: "900", color: "#0F172A", letterSpacing: -1 },
  pill:       { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#EFF5FF", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  pillText:   { color: "#2563EB", fontSize: 11, fontWeight: "700", lineHeight: 14 },
  h1:         { fontSize: 34, fontWeight: "900", color: "#0F172A", letterSpacing: -1, lineHeight: 40 },
  h1Blue:     { color: BLUE },
  sub:        { fontSize: 14, color: "#64748B", lineHeight: 21, marginTop: 12 },
  house:      { width: "78%", aspectRatio: 853 / 520, alignSelf: "center", marginTop: 8 },
  card:       { backgroundColor: "#FFFFFF", borderRadius: 24, borderWidth: 1, borderColor: "#EEF2F7", padding: 16, marginTop: 8, shadowColor: "#0F172A", shadowOpacity: 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  grid:       { flexDirection: "row", flexWrap: "wrap" },
  feat:       { width: "33.33%", alignItems: "center", paddingHorizontal: 4, paddingVertical: 12 },
  featIcon:   { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  featTitle:  { color: "#0F172A", fontSize: 12.5, fontWeight: "800", textAlign: "center" },
  featDesc:   { color: "#94A3B8", fontSize: 11, textAlign: "center", lineHeight: 15, marginTop: 3 },
  cta:        { backgroundColor: BLUE, borderRadius: 28, height: 58, flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 12 },
  ctaText:    { color: "#fff", fontSize: 16, fontWeight: "800" },
  ctaArrow:   { position: "absolute", right: 8, width: 42, height: 42, borderRadius: 21, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  loginBtn:   { borderWidth: 1.5, borderColor: "#C7D7FF", borderRadius: 28, height: 54, alignItems: "center", justifyContent: "center", marginTop: 12 },
  loginText:  { color: BLUE, fontSize: 15, fontWeight: "800" },
});

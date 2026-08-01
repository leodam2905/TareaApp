import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image, Keyboard } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { API_BASE } from "@/lib/api";
import { saveToken, saveRole } from "@/lib/storage";
import { C } from "@/constants/colors";

const IS_HANDYMAN = (Constants.expoConfig?.extra?.appVariant ?? "customer") === "handyman";
const BLUE = "#2563EB";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading]   = useState(false);
  const [kbd, setKbd]           = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKbd(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKbd(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const submit = async () => {
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
      if (!IS_HANDYMAN) { router.replace("/(customer)/tabs/dashboard"); return; }
      if (data.role === "HANDYMAN") router.replace("/(handyman)/tabs/dashboard");
      else router.replace("/(handyman)/become-pro");
    } catch {
      Alert.alert("Error", "Could not connect. Check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  // ── Handyman keeps the existing login ──────────────────────────────────────
  if (IS_HANDYMAN) {
    return (
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={[s.scroll, kbd && { justifyContent: "flex-start" as const, paddingTop: 40 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.headerRow}>
            <View style={s.headerLeft}>
              <View style={s.brandRow}>
                <Image source={require("../../assets/splash-logo.png")} style={s.logo} resizeMode="contain" />
                <Text style={s.brand}>Tarea</Text>
              </View>
              <Text style={s.h1}>Welcome back!</Text>
              {!kbd && <Text style={s.sub}>Log in to your account and continue finding jobs and growing your business.</Text>}
            </View>
            {!kbd && <Image source={require("../../assets/login-illustration.png")} style={s.illo} resizeMode="contain" />}
          </View>
          <View style={s.card}>
            <View style={s.field}>
              <Ionicons name="mail-outline" size={20} color={C.textMuted} />
              <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor={C.textMuted} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            </View>
            <View style={s.divider} />
            <View style={s.field}>
              <Ionicons name="lock-closed-outline" size={20} color={C.textMuted} />
              <TextInput style={s.input} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={C.textMuted} secureTextEntry={!showPw} autoComplete="password" />
              <TouchableOpacity onPress={() => setShowPw(v => !v)} hitSlop={10}><Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={20} color={C.textMuted} /></TouchableOpacity>
            </View>
          </View>
          <View style={s.rowBetween}>
            <TouchableOpacity style={s.remember} onPress={() => setRemember(v => !v)}>
              <View style={[s.checkbox, remember && s.checkboxOn]}>{remember && <Ionicons name="checkmark" size={12} color="#fff" />}</View>
              <Text style={s.rememberText}>Remember me</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password" as any)}><Text style={s.linkBlue}>Forgot password?</Text></TouchableOpacity>
          </View>
          <TouchableOpacity style={[s.loginBtn, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.loginText}>Log in</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Customer: Welcome-back sign-in ─────────────────────────────────────────
  const TRUST = [
    { icon: "ribbon-outline" as const,          color: "#16A34A", title: "Verified Pros",   sub: "Background checked" },
    { icon: "shield-checkmark-outline" as const, color: BLUE,      title: "Secure Payments", sub: "Safe and encrypted" },
    { icon: "headset-outline" as const,          color: "#7C3AED", title: "24/7 Support",    sub: "We're here to help" },
  ];
  return (
    <KeyboardAvoidingView style={cl.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[cl.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={cl.back} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color="#0F172A" />
        </TouchableOpacity>

        {/* Header: text (left) + illustration (right) */}
        <View style={cl.hero}>
          <View style={cl.heroLeft}>
            <Text style={cl.title}>Welcome back!</Text>
            <Text style={cl.subtitle}>Sign in to your Tarea account to book trusted pros for your home.</Text>
            <View style={cl.trustPill}>
              <Ionicons name="shield-checkmark" size={15} color="#16A34A" />
              <Text style={cl.trustPillText}>Secure • Private • Trusted</Text>
            </View>
          </View>
          {!kbd && <Image source={require("../../assets/signin-woman.png")} style={cl.woman} resizeMode="contain" />}
        </View>

        <Text style={cl.sectionLabel}>Sign in with email</Text>

        <View style={cl.field}>
          <Ionicons name="mail-outline" size={20} color={C.textMuted} />
          <TextInput style={cl.input} value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor={C.textMuted} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        </View>
        <View style={cl.field}>
          <Ionicons name="lock-closed-outline" size={20} color={C.textMuted} />
          <TextInput style={cl.input} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={C.textMuted} secureTextEntry={!showPw} autoComplete="password" />
          <TouchableOpacity onPress={() => setShowPw(v => !v)} hitSlop={10}><Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={20} color={C.textMuted} /></TouchableOpacity>
        </View>

        <View style={cl.rowBetween}>
          <TouchableOpacity style={cl.remember} onPress={() => setRemember(v => !v)}>
            <View style={[cl.checkbox, remember && cl.checkboxOn]}>{remember && <Ionicons name="checkmark" size={13} color="#fff" />}</View>
            <Text style={cl.rememberText}>Remember me</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password" as any)}><Text style={cl.linkBlue}>Forgot password?</Text></TouchableOpacity>
        </View>

        <TouchableOpacity style={[cl.cta, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading} activeOpacity={0.9}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={cl.ctaText}>Sign In</Text>}
        </TouchableOpacity>

        <View style={cl.secureCard}>
          <View style={cl.secureIcon}><Ionicons name="shield-checkmark" size={22} color={BLUE} /></View>
          <View style={{ flex: 1 }}>
            <Text style={cl.secureTitle}>Secure & Protected</Text>
            <Text style={cl.secureSub}>Your information is encrypted and never shared with third parties.</Text>
          </View>
        </View>

        <View style={cl.trustRow}>
          {TRUST.map((t, i) => (
            <View key={t.title} style={[cl.trustItem, i < TRUST.length - 1 && cl.trustDivider]}>
              <Ionicons name={t.icon} size={22} color={t.color} />
              <Text style={cl.trustTitle}>{t.title}</Text>
              <Text style={cl.trustSub}>{t.sub}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:        { flex: 1, backgroundColor: C.bg },
  scroll:      { padding: 24, paddingTop: 24, flexGrow: 1, justifyContent: "center" },
  headerRow:   { flexDirection: "row", alignItems: "flex-start", marginBottom: 34 },
  headerLeft:  { flex: 1, paddingTop: 6 },
  brandRow:    { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 22 },
  logo:        { width: 40, height: 40 },
  brand:       { fontSize: 30, fontWeight: "900", color: C.text, letterSpacing: -1 },
  h1:          { fontSize: 30, fontWeight: "900", color: C.text, marginBottom: 10, letterSpacing: -0.5 },
  sub:         { fontSize: 15, color: C.textMuted, lineHeight: 22 },
  illo:        { width: 140, height: 175, marginTop: -4 },
  card:        { borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingHorizontal: 16 },
  field:       { flexDirection: "row", alignItems: "center", gap: 12, height: 58 },
  divider:     { height: 1, backgroundColor: C.line },
  input:       { flex: 1, color: C.text, fontSize: 15 },
  rowBetween:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", rowGap: 8, columnGap: 12, marginTop: 16, marginBottom: 24 },
  remember:    { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox:    { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },
  checkboxOn:  { backgroundColor: BLUE, borderColor: BLUE },
  rememberText:{ color: C.textMuted, fontSize: 14 },
  linkBlue:    { color: BLUE, fontSize: 14, fontWeight: "700" },
  loginBtn:    { backgroundColor: BLUE, borderRadius: 14, paddingVertical: 17, alignItems: "center" },
  loginText:   { color: "#fff", fontSize: 16, fontWeight: "800" },
});

const cl = StyleSheet.create({
  flex:         { flex: 1, backgroundColor: "#FFFFFF" },
  scroll:       { paddingHorizontal: 24 },
  back:         { alignSelf: "flex-start", paddingVertical: 4, marginBottom: 8 },
  hero:         { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  heroLeft:     { flex: 1, paddingRight: 8 },
  title:        { fontSize: 32, lineHeight: 40, fontWeight: "900", color: "#0F172A", letterSpacing: -1 },
  subtitle:     { fontSize: 15, color: "#64748B", lineHeight: 22, marginTop: 12 },
  trustPill:    { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "#F0FDF4", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginTop: 16, borderWidth: 1, borderColor: "#BBF7D0" },
  trustPillText:{ color: "#15803D", fontSize: 13, fontWeight: "700" },
  woman:        { width: 132, height: 132 },

  sectionLabel: { fontSize: 17, fontWeight: "800", color: "#0F172A", marginBottom: 16 },
  field:        { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 14, paddingHorizontal: 16, height: 58, marginBottom: 14 },
  input:        { flex: 1, color: "#0F172A", fontSize: 15 },
  rowBetween:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", rowGap: 8, columnGap: 12, marginTop: 4, marginBottom: 22 },
  remember:     { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox:     { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },
  checkboxOn:   { backgroundColor: BLUE, borderColor: BLUE },
  rememberText: { color: "#475569", fontSize: 14, fontWeight: "600" },
  linkBlue:     { color: BLUE, fontSize: 14, fontWeight: "700" },
  cta:          { backgroundColor: BLUE, borderRadius: 14, height: 56, alignItems: "center", justifyContent: "center" },
  ctaText:      { color: "#fff", fontSize: 16, fontWeight: "800" },
  orRow:        { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 18 },
  orLine:       { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  orText:       { color: "#94A3B8", fontSize: 13, fontWeight: "600" },
  secureCard:   { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderColor: "#DBE7FF", borderRadius: 14, padding: 16 },
  secureIcon:   { width: 44, height: 44, borderRadius: 22, backgroundColor: "#EFF5FF", alignItems: "center", justifyContent: "center" },
  secureTitle:  { color: "#0F172A", fontSize: 15, fontWeight: "800" },
  secureSub:    { color: "#64748B", fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  signupLink:   { alignItems: "center", marginTop: 24 },
  signupText:   { color: "#64748B", fontSize: 14 },
  trustRow:     { flexDirection: "row", backgroundColor: "#F8FAFC", borderRadius: 16, marginTop: 22, paddingVertical: 16, borderWidth: 1, borderColor: "#EEF2F7" },
  trustItem:    { flex: 1, alignItems: "center", gap: 5, paddingHorizontal: 6 },
  trustDivider: { borderRightWidth: 1, borderRightColor: "#E2E8F0" },
  trustTitle:   { color: "#0F172A", fontSize: 12.5, fontWeight: "800", textAlign: "center" },
  trustSub:     { color: "#94A3B8", fontSize: 11, textAlign: "center" },
});

import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image, Animated, Easing } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { API_BASE } from "@/lib/api";
import { C } from "@/constants/colors";

const IS_HANDYMAN = (Constants.expoConfig?.extra?.appVariant ?? "customer") === "handyman";
const BLUE = "#2563EB";

export default function RegisterScreen() {
  const router = useRouter();
  const role: "CUSTOMER" | "HANDYMAN" = IS_HANDYMAN ? "HANDYMAN" : "CUSTOMER";
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [phone, setPhone]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const insets = useSafeAreaInsets();

  const submit = async () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !password) { Alert.alert("Error", "All fields are required"); return; }
    if (password.length < 8) { Alert.alert("Error", "Password must be at least 8 characters"); return; }
    if (password !== confirm) { Alert.alert("Error", "Passwords don't match"); return; }
    if (phone.replace(/\D/g, "").length < 7) { Alert.alert("Error", "Please enter a valid phone number"); return; }
    if (!agreed) { Alert.alert("Please agree", "You must accept the Terms of Service and Privacy Policy to continue."); return; }

    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), password, role, accountType: "INDIVIDUAL" }),
      });
      const data = await res.json();
      if (!res.ok) { Alert.alert("Registration failed", data.error || "Something went wrong"); return; }
      router.replace({ pathname: "/(auth)/verify-otp" as any, params: { pendingToken: data.pendingToken, role: data.role } });
    } catch {
      Alert.alert("Error", "Could not connect. Check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  const pwEye = (shown: boolean, toggle: () => void) => (
    <TouchableOpacity onPress={toggle} hitSlop={10}>
      <Ionicons name={shown ? "eye-off-outline" : "eye-outline"} size={20} color={C.textMuted} />
    </TouchableOpacity>
  );

  // ── Handyman keeps the existing simpler sign-up ────────────────────────────
  if (IS_HANDYMAN) {
    return (
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 20 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={12}>
            <Ionicons name="arrow-back" size={26} color={C.text} />
          </TouchableOpacity>
          <View style={s.headerRow}>
            <View style={s.headerLeft}>
              <View style={s.brandRow}>
                <Image source={require("../../assets/splash-logo.png")} style={s.logo} resizeMode="contain" />
                <Text style={s.brand}>Tarea</Text>
              </View>
              <Text style={s.h1}>Create your account</Text>
              <Text style={s.sub}>Join Tarea and start getting local jobs and growing your business.</Text>
            </View>
            <Image source={require("../../assets/signup-illustration.png")} style={s.illo} resizeMode="contain" />
          </View>
          <Field icon="person-outline" placeholder="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
          <Field icon="mail-outline" placeholder="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Field icon="call-outline" placeholder="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field icon="lock-closed-outline" placeholder="Create password" value={password} onChangeText={setPassword} secureTextEntry={!showPw} right={pwEye(showPw, () => setShowPw(v => !v))} />
          <Field icon="lock-closed-outline" placeholder="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry={!showConfirm} right={pwEye(showConfirm, () => setShowConfirm(v => !v))} />
          <TouchableOpacity style={s.terms} onPress={() => setAgreed(v => !v)} activeOpacity={0.7}>
            <View style={[s.checkbox, agreed && s.checkboxOn]}>{agreed && <Ionicons name="checkmark" size={13} color="#fff" />}</View>
            <Text style={s.termsText}>I agree to the <Text style={s.linkBlue}>Terms of Service</Text> and <Text style={s.linkBlue}>Privacy Policy</Text></Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.signup, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.signupText}>Sign up</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace("/(auth)/login" as any)} style={s.loginLink}>
            <Text style={s.loginText}>Already have an account? <Text style={s.linkBlue}>Log in</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Customer: hero with orbiting tools + white form card ───────────────────
  return (
    <KeyboardAvoidingView style={cr.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[cr.hero, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={cr.back} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={C.text} />
          </TouchableOpacity>
          <View style={cr.brandRow}>
            <Image source={require("../../assets/tarea-home-mark.png")} style={cr.logo} resizeMode="contain" />
            <Text style={cr.brand}>Tarea</Text>
          </View>
          <View style={cr.heroBody}>
            <View style={cr.heroText}>
              <Text style={cr.h1}>Let's get{"\n"}<Text style={cr.h1Blue}>started!</Text></Text>
              <Text style={cr.heroSub}>Create your account and we'll take care of the rest.</Text>
            </View>
            <OrbitTools />
          </View>
        </View>

        {/* Form card */}
        <View style={cr.card}>
          <Text style={cr.cardTitle}>Create your account</Text>
          <View style={cr.progress}><View style={cr.progressFill} /></View>

          <Field icon="person-outline" placeholder="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
          <Field icon="mail-outline" placeholder="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <View style={s.field}>
            <Ionicons name="call-outline" size={20} color={C.textMuted} />
            <Text style={cr.flag}>🇺🇸</Text>
            <Ionicons name="chevron-down" size={13} color={C.textMuted} style={{ marginLeft: -6 }} />
            <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="Phone number" placeholderTextColor={C.textMuted} keyboardType="phone-pad" />
          </View>
          <Field icon="lock-closed-outline" placeholder="Create a password" value={password} onChangeText={setPassword} secureTextEntry={!showPw} right={pwEye(showPw, () => setShowPw(v => !v))} />
          <Field icon="lock-closed-outline" placeholder="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry={!showConfirm} right={pwEye(showConfirm, () => setShowConfirm(v => !v))} />

          <View style={cr.hint}>
            <Ionicons name="shield-checkmark" size={16} color={BLUE} />
            <Text style={cr.hintText}>Use 8+ characters with a mix of letters and numbers</Text>
          </View>

          <TouchableOpacity style={cr.terms} onPress={() => setAgreed(v => !v)} activeOpacity={0.7}>
            <View style={[cr.checkbox, agreed && cr.checkboxOn]}>{agreed && <Ionicons name="checkmark" size={13} color="#fff" />}</View>
            <Text style={cr.termsText}>I agree to the <Text style={cr.linkBlue}>Terms of Service</Text> and <Text style={cr.linkBlue}>Privacy Policy</Text></Text>
          </TouchableOpacity>

          <TouchableOpacity style={[cr.cta, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading} activeOpacity={0.9}>
            {loading ? <ActivityIndicator color="#fff" /> : <>
              <Text style={cr.ctaText}>Create Account</Text>
              <View style={cr.ctaArrow}><Ionicons name="arrow-forward" size={18} color={BLUE} /></View>
            </>}
          </TouchableOpacity>

          <View style={cr.orRow}><View style={cr.orLine} /><Text style={cr.orText}>or</Text><View style={cr.orLine} /></View>

          <TouchableOpacity onPress={() => router.replace("/(auth)/login" as any)} style={cr.loginLink}>
            <Text style={cr.loginText}>Already have an account? <Text style={cr.linkBlue}>Log in</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Four tool icons orbiting a house, staying upright as they rotate.
function OrbitTools() {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  const rot     = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const counter = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-360deg"] });
  const tools: { icon: React.ComponentProps<typeof Ionicons>["name"]; color: string; pos: object }[] = [
    { icon: "construct", color: "#2563EB", pos: { top: 0,    left: 62 } },
    { icon: "brush",     color: "#F59E0B", pos: { right: 0,  top: 62 } },
    { icon: "water",     color: "#10B981", pos: { bottom: 0, left: 62 } },
    { icon: "hammer",    color: "#64748B", pos: { left: 0,   top: 62 } },
  ];
  return (
    <View style={cr.orbitWrap}>
      <Ionicons name="home" size={70} color="#BFD4FF" />
      <Animated.View style={[cr.orbit, { transform: [{ rotate: rot }] }]}>
        {tools.map((t, i) => (
          <Animated.View key={i} style={[cr.toolCard, t.pos, { transform: [{ rotate: counter }] }]}>
            <Ionicons name={t.icon} size={22} color={t.color} />
          </Animated.View>
        ))}
      </Animated.View>
    </View>
  );
}

function Field({ icon, right, ...props }: any) {
  return (
    <View style={s.field}>
      <Ionicons name={icon} size={20} color={C.textMuted} />
      <TextInput style={s.input} placeholderTextColor={C.textMuted} autoCorrect={false} {...props} />
      {right}
    </View>
  );
}

const s = StyleSheet.create({
  flex:        { flex: 1, backgroundColor: C.bg },
  scroll:      { padding: 24, paddingTop: 8, paddingBottom: 16 },
  back:        { alignSelf: "flex-start", paddingVertical: 6 },
  headerRow:   { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  headerLeft:  { flex: 1, paddingTop: 6 },
  brandRow:    { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  logo:        { width: 40, height: 40 },
  brand:       { fontSize: 30, fontWeight: "900", color: C.text, letterSpacing: -1 },
  h1:          { fontSize: 26, fontWeight: "900", color: C.text, marginBottom: 8, letterSpacing: -0.5 },
  sub:         { fontSize: 14, color: C.textMuted, lineHeight: 20 },
  illo:        { width: 130, height: 150, marginLeft: -4 },
  field:       { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 16, height: 52, marginBottom: 10 },
  input:       { flex: 1, color: C.text, fontSize: 15 },
  terms:       { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2, marginBottom: 12 },
  checkbox:    { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },
  checkboxOn:  { backgroundColor: BLUE, borderColor: BLUE },
  termsText:   { flex: 1, color: C.textMuted, fontSize: 13, lineHeight: 18 },
  linkBlue:    { color: BLUE, fontWeight: "700" },
  signup:      { backgroundColor: BLUE, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  signupText:  { color: "#fff", fontSize: 16, fontWeight: "800" },
  loginLink:   { alignItems: "center", marginTop: 8 },
  loginText:   { color: C.textMuted, fontSize: 14 },
});

const cr = StyleSheet.create({
  flex:        { flex: 1, backgroundColor: "#EAF2FF" },
  hero:        { backgroundColor: "#EAF2FF", paddingHorizontal: 24, paddingBottom: 28 },
  back:        { alignSelf: "flex-start", paddingVertical: 4, marginBottom: 6 },
  brandRow:    { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  logo:        { width: 38, height: 38, borderRadius: 9 },
  brand:       { fontSize: 28, fontWeight: "900", color: "#0F172A", letterSpacing: -1 },
  heroBody:    { flexDirection: "row", alignItems: "center", marginTop: 6 },
  heroText:    { flex: 1, paddingRight: 8 },
  h1:          { fontSize: 34, fontWeight: "900", color: "#0F172A", letterSpacing: -1, lineHeight: 38 },
  h1Blue:      { color: BLUE },
  heroSub:     { fontSize: 14, color: "#5B6472", lineHeight: 20, marginTop: 12 },

  orbitWrap:   { width: 168, height: 168, alignItems: "center", justifyContent: "center" },
  orbit:       { position: "absolute", top: 0, left: 0, width: 168, height: 168 },
  toolCard:    { position: "absolute", width: 44, height: 44, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#1E3A8A", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },

  card:        { backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -20, paddingHorizontal: 24, paddingTop: 24 },
  cardTitle:   { fontSize: 22, fontWeight: "900", color: "#0F172A", letterSpacing: -0.5 },
  progress:    { height: 4, borderRadius: 2, backgroundColor: "#E2E8F0", marginTop: 10, marginBottom: 20, width: 120 },
  progressFill:{ height: 4, borderRadius: 2, backgroundColor: BLUE, width: "45%" },
  flag:        { fontSize: 18 },

  hint:        { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#EFF5FF", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 2, marginBottom: 14 },
  hintText:    { flex: 1, color: "#475569", fontSize: 13, lineHeight: 18 },

  terms:       { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  checkbox:    { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },
  checkboxOn:  { backgroundColor: BLUE, borderColor: BLUE },
  termsText:   { flex: 1, color: "#475569", fontSize: 13, lineHeight: 18 },
  linkBlue:    { color: BLUE, fontWeight: "700" },

  cta:         { backgroundColor: BLUE, borderRadius: 28, height: 58, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  ctaText:     { color: "#fff", fontSize: 16, fontWeight: "800" },
  ctaArrow:    { position: "absolute", right: 8, width: 42, height: 42, borderRadius: 21, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },

  orRow:       { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 16 },
  orLine:      { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  orText:      { color: "#94A3B8", fontSize: 13, fontWeight: "600" },

  loginLink:   { alignItems: "center" },
  loginText:   { color: "#64748B", fontSize: 14 },
});

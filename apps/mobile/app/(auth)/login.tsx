import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image, Keyboard } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { API_BASE } from "@/lib/api";
import { saveToken, saveRole } from "@/lib/storage";
import { C } from "@/constants/colors";

const IS_HANDYMAN = (Constants.expoConfig?.extra?.appVariant ?? "customer") === "handyman";
const BLUE = "#2563EB";

export default function LoginScreen() {
  const router = useRouter();
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

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Header: logo + heading (left), door illustration (right) */}
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            <View style={s.brandRow}>
              <Image source={require("../../assets/splash-logo.png")} style={s.logo} resizeMode="contain" />
              <Text style={s.brand}>Tarea</Text>
            </View>
            <Text style={s.h1}>Welcome back!</Text>
            <Text style={s.sub}>{IS_HANDYMAN ? "Log in to your account and continue finding jobs and growing your business." : "Log in to your account and book trusted pros in minutes."}</Text>
          </View>
          {!kbd && <Image source={require("../../assets/login-illustration.png")} style={s.illo} resizeMode="contain" />}
        </View>

        {/* Login card */}
        <View style={s.card}>
          <View style={s.field}>
            <Ionicons name="mail-outline" size={20} color={C.textMuted} />
            <TextInput style={s.input} value={email} onChangeText={setEmail}
              placeholder="Email address" placeholderTextColor={C.textMuted}
              autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          </View>
          <View style={s.divider} />
          <View style={s.field}>
            <Ionicons name="lock-closed-outline" size={20} color={C.textMuted} />
            <TextInput style={s.input} value={password} onChangeText={setPassword}
              placeholder="Password" placeholderTextColor={C.textMuted}
              secureTextEntry={!showPw} autoComplete="password" />
            <TouchableOpacity onPress={() => setShowPw(v => !v)} hitSlop={10}>
              <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={20} color={C.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Remember + forgot */}
        <View style={s.rowBetween}>
          <TouchableOpacity style={s.remember} onPress={() => setRemember(v => !v)}>
            <View style={[s.checkbox, remember && s.checkboxOn]}>{remember && <Ionicons name="checkmark" size={12} color="#fff" />}</View>
            <Text style={s.rememberText}>Remember me</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password" as any)}>
            <Text style={s.linkBlue}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[s.loginBtn, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.loginText}>Log in</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(auth)/register" as any)} style={s.signupLink}>
          <Text style={s.signupText}>Don't have an account? <Text style={s.linkBlue}>Sign up</Text></Text>
        </TouchableOpacity>
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

  rowBetween:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 24 },
  remember:    { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox:    { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },
  checkboxOn:  { backgroundColor: BLUE, borderColor: BLUE },
  rememberText:{ color: C.textMuted, fontSize: 14 },
  linkBlue:    { color: BLUE, fontSize: 14, fontWeight: "700" },

  loginBtn:    { backgroundColor: BLUE, borderRadius: 14, paddingVertical: 17, alignItems: "center" },
  loginText:   { color: "#fff", fontSize: 16, fontWeight: "800" },
  signupLink:  { alignItems: "center", marginTop: 22 },
  signupText:  { color: C.textMuted, fontSize: 14 },
});

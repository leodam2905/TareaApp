import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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

  const soon = () => Alert.alert("Coming soon", "Social sign-up will be available shortly. Please sign up with your email for now.");

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={12}>
          <Ionicons name="arrow-back" size={26} color={C.text} />
        </TouchableOpacity>

        {/* Header: logo + heading (left) and illustration (right) */}
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            <View style={s.brandRow}>
              <Image source={require("../../assets/splash-logo.png")} style={s.logo} resizeMode="contain" />
              <Text style={s.brand}>{IS_HANDYMAN ? "Tarea" : "Tarea"}</Text>
            </View>
            <Text style={s.h1}>Create your account</Text>
            <Text style={s.sub}>{IS_HANDYMAN ? "Join Tarea and start getting local jobs and growing your business." : "Join Tarea and book trusted pros in minutes."}</Text>
          </View>
          <Image source={require("../../assets/signup-illustration.png")} style={s.illo} resizeMode="contain" />
        </View>

        {/* Fields */}
        <Field icon="person-outline"      placeholder="Full name"    value={name}  onChangeText={setName}  autoCapitalize="words" />
        <Field icon="mail-outline"        placeholder="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Field icon="call-outline"        placeholder="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field icon="lock-closed-outline" placeholder="Create password" value={password} onChangeText={setPassword} secureTextEntry={!showPw}
          right={<TouchableOpacity onPress={() => setShowPw(v => !v)} hitSlop={10}><Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={20} color={C.textMuted} /></TouchableOpacity>} />
        <Field icon="lock-closed-outline" placeholder="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry={!showConfirm}
          right={<TouchableOpacity onPress={() => setShowConfirm(v => !v)} hitSlop={10}><Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={20} color={C.textMuted} /></TouchableOpacity>} />

        {/* Terms */}
        <TouchableOpacity style={s.terms} onPress={() => setAgreed(v => !v)} activeOpacity={0.7}>
          <View style={[s.checkbox, agreed && s.checkboxOn]}>{agreed && <Ionicons name="checkmark" size={13} color="#fff" />}</View>
          <Text style={s.termsText}>I agree to the <Text style={s.linkBlue}>Terms of Service</Text> and <Text style={s.linkBlue}>Privacy Policy</Text></Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.signup, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.signupText}>Sign up</Text>}
        </TouchableOpacity>

        <View style={s.orRow}>
          <View style={s.orLine} /><Text style={s.orText}>or</Text><View style={s.orLine} />
        </View>

        <TouchableOpacity style={s.social} onPress={soon}>
          <Ionicons name="logo-google" size={20} color="#EA4335" />
          <Text style={s.socialText}>Continue with Google</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.social} onPress={soon}>
          <Ionicons name="logo-apple" size={20} color={C.text} />
          <Text style={s.socialText}>Continue with Apple</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/(auth)/login" as any)} style={s.loginLink}>
          <Text style={s.loginText}>Already have an account? <Text style={s.linkBlue}>Log in</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  scroll:      { padding: 24, paddingTop: 8, paddingBottom: 32 },
  back:        { alignSelf: "flex-start", paddingVertical: 8 },

  headerRow:   { flexDirection: "row", alignItems: "flex-start", marginBottom: 22 },
  headerLeft:  { flex: 1, paddingTop: 6 },
  brandRow:    { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  logo:        { width: 40, height: 40 },
  brand:       { fontSize: 30, fontWeight: "900", color: C.text, letterSpacing: -1 },
  h1:          { fontSize: 26, fontWeight: "900", color: C.text, marginBottom: 8, letterSpacing: -0.5 },
  sub:         { fontSize: 14, color: C.textMuted, lineHeight: 20 },
  illo:        { width: 130, height: 150, marginLeft: -4 },

  field:       { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 16, height: 56, marginBottom: 12 },
  input:       { flex: 1, color: C.text, fontSize: 15 },

  terms:       { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, marginBottom: 18 },
  checkbox:    { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },
  checkboxOn:  { backgroundColor: BLUE, borderColor: BLUE },
  termsText:   { flex: 1, color: C.textMuted, fontSize: 13, lineHeight: 18 },
  linkBlue:    { color: BLUE, fontWeight: "700" },

  signup:      { backgroundColor: BLUE, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  signupText:  { color: C.text, fontSize: 16, fontWeight: "800" },

  orRow:       { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 20 },
  orLine:      { flex: 1, height: 1, backgroundColor: C.line },
  orText:      { color: C.textMuted, fontSize: 13, fontWeight: "600" },

  social:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 15, marginBottom: 12 },
  socialText:  { color: C.text, fontSize: 15, fontWeight: "700" },

  loginLink:   { alignItems: "center", marginTop: 10 },
  loginText:   { color: C.textMuted, fontSize: 14 },
});

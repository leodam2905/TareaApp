import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { API_BASE } from "@/lib/api";
import { saveToken, saveRole } from "@/lib/storage";
import { C } from "@/constants/colors";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);

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
      if (data.role === "HANDYMAN") router.replace("/(handyman)/tabs/dashboard");
      else router.replace("/(customer)/tabs/dashboard");
    } catch {
      Alert.alert("Error", "Could not connect. Check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Text style={s.logo}>Tarea</Text>
          <Text style={s.subtitle}>Sign in to your account</Text>
        </View>

        <View style={s.card}>
          <Text style={s.label}>Email</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail}
            placeholder="you@email.com" placeholderTextColor={C.slate500}
            autoCapitalize="none" keyboardType="email-address" autoComplete="email" />

          <Text style={s.label}>Password</Text>
          <TextInput style={s.input} value={password} onChangeText={setPassword}
            placeholder="••••••••" placeholderTextColor={C.slate500}
            secureTextEntry autoComplete="password" />

          <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color={C.ink} /> : <Text style={s.btnText}>Sign In</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/(auth)/register")} style={s.link}>
            <Text style={s.linkText}>Don't have an account? <Text style={s.linkBold}>Sign up</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:        { flex: 1, backgroundColor: C.ink },
  container:   { flexGrow: 1, justifyContent: "center", padding: 24 },
  header:      { alignItems: "center", marginBottom: 40 },
  logo:        { fontSize: 42, fontWeight: "900", color: C.sky, letterSpacing: -1 },
  subtitle:    { color: C.slate400, fontSize: 15, marginTop: 6 },
  card:        { backgroundColor: "#1E293B", borderRadius: 20, padding: 24, gap: 4 },
  label:       { color: C.slate400, fontSize: 13, fontWeight: "600", marginTop: 12, marginBottom: 6 },
  input:       { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: C.white, fontSize: 15 },
  btn:         { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 20 },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: C.ink, fontWeight: "800", fontSize: 16 },
  link:        { alignItems: "center", marginTop: 20 },
  linkText:    { color: C.slate400, fontSize: 14 },
  linkBold:    { color: C.sky, fontWeight: "700" },
});

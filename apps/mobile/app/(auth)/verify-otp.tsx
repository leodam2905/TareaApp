import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import Constants from "expo-constants";
import { API_BASE } from "@/lib/api";
import { saveToken, saveRole } from "@/lib/storage";
import { C } from "@/constants/colors";

const IS_HANDYMAN = (Constants.expoConfig?.extra?.appVariant ?? "customer") === "handyman";

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { pendingToken, role } = useLocalSearchParams<{ pendingToken: string; role: string }>();
  const [code, setCode]         = useState("");
  const [loading, setLoading]   = useState(false);
  const [resending, setResending] = useState(false);

  const verify = async () => {
    if (code.length !== 6) { Alert.alert("Error", "Enter the 6-digit code"); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken, code }),
      });
      const data = await res.json();
      if (!res.ok) { Alert.alert("Verification failed", data.error || "Invalid code"); return; }
      await saveToken(data.token);
      await saveRole(data.role);
      // This screen runs on EVERY OTP login, not just first signup — so route to
      // the app's home (by mode), never into onboarding. Sending handymen to /ica
      // here forced already-onboarded users to redo setup on every single login.
      // New handymen still get the setup checklist from the dashboard.
      if (!IS_HANDYMAN) { router.replace("/(customer)/tabs/dashboard" as any); return; }
      if (data.role === "HANDYMAN") router.replace("/(handyman)/tabs/dashboard" as any);
      else router.replace("/(handyman)/become-pro" as any);
    } catch {
      Alert.alert("Error", "Could not connect. Check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      const res  = await fetch(`${API_BASE}/api/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken }),
      });
      const data = await res.json();
      if (res.ok) Alert.alert("Code sent", "A new code was sent to your phone.");
      else Alert.alert("Error", data.error || "Could not resend code");
    } catch {
      Alert.alert("Error", "Could not connect.");
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" bounces={false}>
      <View style={s.header}>
        <Text style={s.logo}>Tarea</Text>
        <Text style={s.title}>Verify your phone</Text>
        <Text style={s.subtitle}>Enter the 6-digit code sent to your number</Text>
      </View>

      <View style={s.card}>
        <TextInput
          style={s.codeInput}
          value={code}
          onChangeText={t => setCode(t.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          placeholderTextColor={C.slate500}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          textAlign="center"
        />

        <TouchableOpacity style={[s.btn, (loading || code.length !== 6) && s.btnDisabled]} onPress={verify} disabled={loading || code.length !== 6}>
          {loading ? <ActivityIndicator color={C.ink} /> : <Text style={s.btnText}>Verify</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.resendBtn} onPress={resend} disabled={resending}>
          {resending
            ? <ActivityIndicator color={C.sky} size="small" />
            : <Text style={s.resendText}>Didn't get a code? <Text style={s.resendBold}>Resend</Text></Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/(auth)/register" as any)} style={s.backBtn}>
          <Text style={s.backText}>← Back to sign up</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:       { flex: 1, backgroundColor: C.bg },
  container:  { flexGrow: 1, backgroundColor: C.bg, justifyContent: "center", padding: 24 },
  header:     { alignItems: "center", marginBottom: 40 },
  logo:       { fontSize: 42, fontWeight: "900", color: C.sky, letterSpacing: -1 },
  title:      { color: C.text, fontSize: 22, fontWeight: "800", marginTop: 16 },
  subtitle:   { color: C.textMuted, fontSize: 14, marginTop: 6, textAlign: "center" },
  card:       { backgroundColor: C.surface, borderRadius: 20, padding: 24, gap: 16 },
  codeInput:  { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 18, color: C.text, fontSize: 32, fontWeight: "800", letterSpacing: 12 },
  btn:        { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  btnDisabled:{ opacity: 0.5 },
  btnText:    { color: C.ink, fontWeight: "800", fontSize: 16 },
  resendBtn:  { alignItems: "center", paddingVertical: 4 },
  resendText: { color: C.textMuted, fontSize: 14 },
  resendBold: { color: C.sky, fontWeight: "700" },
  backBtn:    { alignItems: "center", paddingVertical: 4 },
  backText:   { color: C.slate500, fontSize: 13 },
});

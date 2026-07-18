import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { API_BASE } from "@/lib/api";
import { C } from "@/constants/colors";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]     = useState(false);

  const submit = async () => {
    if (!email.trim()) { Alert.alert("Error", "Please enter your email"); return; }
    setLoading(true);
    try {
      await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      // Backend always returns ok (prevents email enumeration).
      setSent(true);
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
          <Text style={s.subtitle}>Reset your password</Text>
        </View>

        <View style={s.card}>
          {sent ? (
            <>
              <Text style={s.sentEmoji}>📧</Text>
              <Text style={s.sentTitle}>Check your email</Text>
              <Text style={s.sentText}>
                If an account exists for{"\n"}<Text style={s.sentBold}>{email.trim().toLowerCase()}</Text>,{"\n"}
                we've sent a link to reset your password. It expires in 1 hour.
              </Text>
              <TouchableOpacity style={s.btn} onPress={() => router.replace("/(auth)/login" as any)}>
                <Text style={s.btnText}>Back to Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.link} onPress={() => setSent(false)}>
                <Text style={s.linkText}>Didn't get it? <Text style={s.linkBold}>Try again</Text></Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.info}>Enter the email for your account and we'll send you a link to set a new password.</Text>
              <Text style={s.label}>Email</Text>
              <TextInput style={s.input} value={email} onChangeText={setEmail}
                placeholder="you@email.com" placeholderTextColor={C.slate500}
                autoCapitalize="none" keyboardType="email-address" autoComplete="email" autoFocus />

              <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
                {loading ? <ActivityIndicator color={C.ink} /> : <Text style={s.btnText}>Send Reset Link</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={s.link} onPress={() => router.replace("/(auth)/login" as any)}>
                <Text style={s.linkText}>Remembered it? <Text style={s.linkBold}>Sign in</Text></Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:        { flex: 1, backgroundColor: C.bg },
  container:   { flexGrow: 1, justifyContent: "center", padding: 24 },
  header:      { alignItems: "center", marginBottom: 40 },
  logo:        { fontSize: 42, fontWeight: "900", color: C.sky, letterSpacing: -1 },
  subtitle:    { color: C.textMuted, fontSize: 15, marginTop: 6 },
  card:        { backgroundColor: C.surface, borderRadius: 20, padding: 24 },
  info:        { color: C.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  label:       { color: C.textMuted, fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input:       { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: C.text, fontSize: 15 },
  btn:         { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 20 },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: C.ink, fontWeight: "800", fontSize: 16 },
  link:        { alignItems: "center", marginTop: 20 },
  linkText:    { color: C.textMuted, fontSize: 14 },
  linkBold:    { color: C.sky, fontWeight: "700" },
  sentEmoji:   { fontSize: 44, textAlign: "center", marginBottom: 8 },
  sentTitle:   { color: C.text, fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 10 },
  sentText:    { color: C.textMuted, fontSize: 14, lineHeight: 21, textAlign: "center" },
  sentBold:    { color: C.text, fontWeight: "700" },
});

import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { API_BASE } from "@/lib/api";
import { C } from "@/constants/colors";

const IS_HANDYMAN = (Constants.expoConfig?.extra?.appVariant ?? "customer") === "handyman";

export default function RegisterScreen() {
  const router = useRouter();
  // The app you're in decides the role: Pro app = handyman, Home app = customer.
  const role: "CUSTOMER" | "HANDYMAN" = IS_HANDYMAN ? "HANDYMAN" : "CUSTOMER";
  const [name, setName]               = useState("");
  const [email, setEmail]             = useState("");
  const [phone, setPhone]             = useState("");
  const [password, setPassword]       = useState("");
  const [isCompany, setIsCompany]     = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading]         = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !password) {
      Alert.alert("Error", "All fields are required");
      return;
    }
    if (password.length < 8) { Alert.alert("Error", "Password must be at least 8 characters"); return; }
    if (phone.replace(/\D/g, "").length < 7) { Alert.alert("Error", "Please enter a valid phone number"); return; }
    if (isCompany && !companyName.trim()) { Alert.alert("Error", "Please enter your company name"); return; }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        role,
        accountType: isCompany ? "COMPANY" : "INDIVIDUAL",
      };
      if (isCompany) body.companyName = companyName.trim();
      if (referralCode.trim()) body.referralCode = referralCode.trim().toUpperCase();

      const res  = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { Alert.alert("Registration failed", data.error || "Something went wrong"); return; }

      router.replace({
        pathname: "/(auth)/verify-otp" as any,
        params: { pendingToken: data.pendingToken, role: data.role },
      });
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
          <Text style={s.logo}>{IS_HANDYMAN ? "Tarea Pro" : "Tarea"}</Text>
          <Text style={s.subtitle}>{IS_HANDYMAN ? "Create your Pro account" : "Create your account"}</Text>
        </View>

        <View style={s.card}>
          {/* Account type toggle — only for customers */}
          {role === "CUSTOMER" && (
            <>
              <Text style={s.label}>Account type</Text>
              <View style={s.roleRow}>
                <TouchableOpacity style={[s.roleBtn, !isCompany && s.roleBtnActive]} onPress={() => setIsCompany(false)}>
                  <Text style={s.roleEmoji}>👤</Text>
                  <Text style={[s.roleLabel, !isCompany && s.roleLabelActive]}>Individual</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.roleBtn, isCompany && s.roleBtnActive]} onPress={() => setIsCompany(true)}>
                  <Text style={s.roleEmoji}>🏢</Text>
                  <Text style={[s.roleLabel, isCompany && s.roleLabelActive]}>Company</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Company name — only when company is selected */}
          {isCompany && (
            <>
              <Text style={s.label}>Company Name</Text>
              <TextInput style={s.input} value={companyName} onChangeText={setCompanyName}
                placeholder="Acme Corp" placeholderTextColor={C.slate500} autoCapitalize="words" />
            </>
          )}

          <Text style={s.label}>{isCompany ? "Contact Name" : "Full Name"}</Text>
          <TextInput style={s.input} value={name} onChangeText={setName}
            placeholder={isCompany ? "Jane Smith" : "John Smith"} placeholderTextColor={C.slate500} autoCapitalize="words" />

          <Text style={s.label}>Email</Text>
          <TextInput style={s.input} value={email} onChangeText={setEmail}
            placeholder="you@email.com" placeholderTextColor={C.slate500}
            autoCapitalize="none" keyboardType="email-address" />

          <Text style={s.label}>Phone</Text>
          <TextInput style={s.input} value={phone} onChangeText={setPhone}
            placeholder="+1 (555) 000-0000" placeholderTextColor={C.slate500}
            keyboardType="phone-pad" />

          <Text style={s.label}>Password</Text>
          <TextInput style={s.input} value={password} onChangeText={setPassword}
            placeholder="Min. 8 characters" placeholderTextColor={C.slate500} secureTextEntry />

          <Text style={s.label}>Referral Code <Text style={s.optional}>(optional)</Text></Text>
          <TextInput style={s.input} value={referralCode} onChangeText={setReferralCode}
            placeholder="e.g. JOHN1A2B" placeholderTextColor={C.slate500}
            autoCapitalize="characters" autoCorrect={false} />

          <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color={C.ink} /> : <Text style={s.btnText}>Create Account</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/(auth)/login" as any)} style={s.link}>
            <Text style={s.linkText}>Already have an account? <Text style={s.linkBold}>Sign in</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:           { flex: 1, backgroundColor: C.ink },
  container:      { flexGrow: 1, justifyContent: "center", padding: 24 },
  header:         { alignItems: "center", marginBottom: 40 },
  logo:           { fontSize: 42, fontWeight: "900", color: C.sky, letterSpacing: -1 },
  subtitle:       { color: C.slate400, fontSize: 15, marginTop: 6 },
  card:           { backgroundColor: "#1E293B", borderRadius: 20, padding: 24, gap: 4 },
  label:          { color: C.slate400, fontSize: 13, fontWeight: "600", marginTop: 12, marginBottom: 6 },
  roleRow:        { flexDirection: "row", gap: 10 },
  roleBtn:        { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", padding: 14, alignItems: "center", gap: 6 },
  roleBtnActive:  { borderColor: C.sky, backgroundColor: "rgba(56,189,248,0.08)" },
  roleEmoji:      { fontSize: 22 },
  roleLabel:      { color: C.slate400, fontSize: 13, fontWeight: "600", textAlign: "center" },
  roleLabelActive:{ color: C.sky },
  input:          { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: C.white, fontSize: 15 },
  btn:            { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 20 },
  btnDisabled:    { opacity: 0.6 },
  btnText:        { color: C.ink, fontWeight: "800", fontSize: 16 },
  link:           { alignItems: "center", marginTop: 20 },
  linkText:       { color: C.slate400, fontSize: 14 },
  linkBold:       { color: C.sky, fontWeight: "700" },
  optional:       { color: C.slate500, fontWeight: "400" },
});

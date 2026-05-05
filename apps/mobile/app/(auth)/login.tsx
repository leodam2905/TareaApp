import { useRef, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "../../constants/api";
import { colors, fontSize, radius, spacing } from "../../constants/theme";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});
type FormData = z.infer<typeof schema>;

const OTP_LENGTH = 6;

export default function LoginScreen() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // OTP state
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [phoneMask, setPhoneMask] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  // Phone collection step
  const [requiresPhone, setRequiresPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  // ── Step 1: credentials ──────────────────────────────────────────────
  const onSubmit = async (data: FormData) => {
    setLoading(true); setError("");
    try {
      const res = await api.post("/auth/login", data);
      const { role, token } = res.data;
      if (token) await SecureStore.setItemAsync("tarea_token", token);
      if (role) await SecureStore.setItemAsync("tarea_role", role);
      router.replace(role === "HANDYMAN" ? "/(handyman)/tabs/dashboard" : "/(customer)/tabs/dashboard");
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } }).response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // ── OTP digit change ─────────────────────────────────────────────────
  const handleDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      const next = [...otp];
      next[index - 1] = "";
      setOtp(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ── Submit phone ─────────────────────────────────────────────────────
  const submitPhone = async () => {
    if (!phoneInput.trim()) { setError("Enter your phone number"); return; }
    setLoading(true); setError("");
    try {
      const res = await api.post("/auth/add-phone", { pendingToken, phone: phoneInput.trim() });
      setRequiresPhone(false);
      setPendingToken(res.data.pendingToken);
      setPhoneMask(res.data.phoneMask ?? "");
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify OTP ───────────────────────────────────────────────
  const verifyOtp = async () => {
    const code = otp.join("");
    if (code.length < OTP_LENGTH) { setError("Enter the full 6-digit code"); return; }
    setLoading(true); setError("");
    try {
      const res = await api.post("/auth/verify-otp", { pendingToken, code });
      await SecureStore.setItemAsync("tarea_token", res.data.token || "");
      await SecureStore.setItemAsync("tarea_role", res.data.role);
      await SecureStore.setItemAsync("tarea_user", JSON.stringify(res.data));
      router.replace(res.data.role === "HANDYMAN" ? "/(handyman)/tabs/dashboard" : "/(customer)/tabs/dashboard");
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } }).response?.data?.error || "Verification failed");
      setOtp(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ───────────────────────────────────────────────────────
  const resendOtp = async () => {
    setResending(true);
    try {
      const res = await api.post("/auth/resend-otp", { pendingToken });
      setPendingToken(res.data.pendingToken);
      setOtp(Array(OTP_LENGTH).fill(""));
      setError("");
    } catch {
      setError("Could not resend code");
    } finally {
      setResending(false);
    }
  };

  // ── Add-phone Screen ─────────────────────────────────────────────────
  if (requiresPhone) {
    return (
      <LinearGradient colors={["#0F2560", "#0F172A"]} style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Pressable onPress={() => { setRequiresPhone(false); setPendingToken(null); }} style={styles.back}>
              <Ionicons name="arrow-back" size={22} color={colors.white} />
            </Pressable>
            <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
              <View style={styles.shieldWrap}>
                <Ionicons name="phone-portrait" size={36} color={colors.skyBlue} />
              </View>
              <Text style={styles.title}>Add your phone</Text>
              <Text style={styles.subtitle}>We'll send a verification code each time you sign in.</Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.form}>
              {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Phone number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+1 (555) 000-0000"
                  placeholderTextColor={colors.inkSubtle}
                  keyboardType="phone-pad"
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                  autoFocus
                />
              </View>
              <Pressable
                style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }, loading && { opacity: 0.7 }]}
                onPress={submitPhone}
                disabled={loading}
              >
                <Text style={styles.btnPrimaryText}>{loading ? "Sending…" : "Send Verification Code"}</Text>
              </Pressable>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    );
  }

  // ── OTP Screen ───────────────────────────────────────────────────────
  if (pendingToken) {
    return (
      <LinearGradient colors={["#0F2560", "#0F172A"]} style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Pressable onPress={() => { setPendingToken(null); setOtp(Array(OTP_LENGTH).fill("")); }} style={styles.back}>
              <Ionicons name="arrow-back" size={22} color={colors.white} />
            </Pressable>

            <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
              <View style={styles.shieldWrap}>
                <Ionicons name="shield-checkmark" size={36} color={colors.skyBlue} />
              </View>
              <Text style={styles.title}>Verify your phone</Text>
              <Text style={styles.subtitle}>
                We sent a 6-digit code to {phoneMask || "your phone"}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.form}>
              {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

              {/* OTP boxes */}
              <View style={styles.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={el => { inputRefs.current[i] = el; }}
                    style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                    value={digit}
                    onChangeText={v => handleDigit(i, v)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    placeholder="·"
                    placeholderTextColor={colors.inkSubtle}
                  />
                ))}
              </View>

              <Pressable
                style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }, (loading || otp.join("").length < OTP_LENGTH) && { opacity: 0.6 }]}
                onPress={verifyOtp}
                disabled={loading || otp.join("").length < OTP_LENGTH}
              >
                <Text style={styles.btnPrimaryText}>{loading ? "Verifying…" : "Verify Code"}</Text>
              </Pressable>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Didn't receive it? </Text>
                <Pressable onPress={resendOtp} disabled={resending}>
                  <Text style={[styles.link, resending && { opacity: 0.5 }]}>
                    {resending ? "Sending…" : "Resend code"}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    );
  }

  // ── Credentials Screen ───────────────────────────────────────────────
  return (
    <LinearGradient colors={["#0F2560", "#0F172A"]} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </Pressable>

          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your Tarea account</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.form}>
            {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Email</Text>
              <Controller control={control} name="email" render={({ field: { onChange, value } }) => (
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.inkSubtle}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={value}
                  onChangeText={onChange}
                />
              )} />
              {errors.email && <Text style={styles.error}>{errors.email.message}</Text>}
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.pwWrap}>
                <Controller control={control} name="password" render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, styles.pwInput, errors.password && styles.inputError]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.inkSubtle}
                    secureTextEntry={!showPw}
                    value={value}
                    onChangeText={onChange}
                  />
                )} />
                <Pressable style={styles.eyeBtn} onPress={() => setShowPw(!showPw)}>
                  <Ionicons name={showPw ? "eye-off" : "eye"} size={20} color={colors.inkSubtle} />
                </Pressable>
              </View>
              {errors.password && <Text style={styles.error}>{errors.password.message}</Text>}
            </View>

            <Pressable
              style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }, loading && { opacity: 0.7 }]}
              onPress={handleSubmit(onSubmit)}
              disabled={loading}
            >
              <Text style={styles.btnPrimaryText}>{loading ? "Checking…" : "Continue"}</Text>
            </Pressable>

            <View style={styles.otpNote}>
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.inkSubtle} />
              <Text style={styles.otpNoteText}>A verification code will be sent to your phone</Text>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <Pressable onPress={() => router.push("/(auth)/register")}>
                <Text style={styles.link}>Create one</Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 40 },
  back: { marginBottom: spacing.xl },
  header: { marginBottom: spacing.xl, alignItems: "center" },
  shieldWrap: { width: 72, height: 72, borderRadius: radius.xl, backgroundColor: "rgba(56,189,248,0.12)", borderWidth: 1, borderColor: "rgba(56,189,248,0.3)", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  title: { fontSize: fontSize["3xl"], fontWeight: "800", color: colors.white, marginBottom: 6, textAlign: "center" },
  subtitle: { fontSize: fontSize.base, color: "rgba(255,255,255,0.5)", textAlign: "center" },
  form: { gap: spacing.lg },
  errorBanner: { backgroundColor: "rgba(239,68,68,0.15)", borderWidth: 1, borderColor: "rgba(239,68,68,0.3)", borderRadius: radius.md, padding: spacing.md, color: "#FCA5A5", fontSize: fontSize.sm },
  fieldWrap: { gap: 6 },
  label: { fontSize: fontSize.sm, fontWeight: "600", color: "rgba(255,255,255,0.6)" },
  input: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14, color: colors.white, fontSize: fontSize.base },
  inputError: { borderColor: "rgba(239,68,68,0.5)" },
  pwWrap: { position: "relative" },
  pwInput: { paddingRight: 52 },
  eyeBtn: { position: "absolute", right: 14, top: 14 },
  error: { fontSize: fontSize.xs, color: "#FCA5A5" },
  btnPrimary: { backgroundColor: colors.skyBlue, borderRadius: radius.lg, paddingVertical: 16, alignItems: "center", marginTop: 8, shadowColor: colors.skyBlue, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16 },
  btnPrimaryText: { fontSize: fontSize.lg, fontWeight: "800", color: colors.ink },
  otpNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  otpNoteText: { color: "rgba(255,255,255,0.35)", fontSize: fontSize.xs },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 8 },
  footerText: { color: "rgba(255,255,255,0.45)", fontSize: fontSize.sm },
  link: { color: colors.skyBlue, fontSize: fontSize.sm, fontWeight: "700" },
  // OTP-specific
  otpRow: { flexDirection: "row", justifyContent: "center", gap: 10 },
  otpBox: { width: 46, height: 56, borderRadius: radius.md, borderWidth: 2, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.06)", color: colors.white, fontSize: fontSize["2xl"], fontWeight: "800", textAlign: "center" },
  otpBoxFilled: { borderColor: colors.skyBlue, backgroundColor: "rgba(56,189,248,0.1)" },
});

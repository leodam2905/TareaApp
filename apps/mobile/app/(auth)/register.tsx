import { useState, useRef } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "../../constants/api";
import { colors, fontSize, radius, spacing } from "../../constants/theme";

const OTP_LENGTH = 6;

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(10, "Enter a valid phone number"),
  password: z.string().min(8, "Min. 8 characters"),
  role: z.enum(["CUSTOMER", "HANDYMAN"]),
});
type FormData = z.infer<typeof schema>;

export default function RegisterScreen() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // OTP step
  const [step, setStep] = useState<"form" | "otp">("form");
  const [pendingToken, setPendingToken] = useState("");
  const [pendingRole, setPendingRole] = useState<"CUSTOMER" | "HANDYMAN">("CUSTOMER");
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(""));
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: "CUSTOMER" },
  });
  const role = watch("role");

  const onSubmit = async (data: FormData) => {
    setLoading(true); setError("");
    try {
      const res = await api.post("/auth/register", {
        name: data.name,
        email: data.email,
        phone: data.phone.replace(/\D/g, "").replace(/^(\d{10})$/, "+1$1").replace(/^1(\d{10})$/, "+1$1"),
        password: data.password,
        role: data.role,
      });
      setPendingToken(res.data.pendingToken);
      setPendingRole(data.role);
      setStep("otp");
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } }).response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    if (next.every(d => d) && next.join("").length === OTP_LENGTH) verifyOtp(next.join(""));
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      const next = [...otp]; next[index - 1] = "";
      setOtp(next); inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyOtp = async (code: string) => {
    setLoading(true); setError("");
    try {
      const res = await api.post("/auth/verify-otp", { pendingToken, code });
      await SecureStore.setItemAsync("tarea_token", res.data.token || "");
      await SecureStore.setItemAsync("tarea_role", res.data.role);
      await SecureStore.setItemAsync("tarea_user", JSON.stringify(res.data));
      router.replace(pendingRole === "HANDYMAN" ? "/(handyman)/tabs/dashboard" : "/(customer)/tabs/dashboard");
    } catch {
      setError("Invalid or expired code. Try again.");
      setOtp(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setResending(true);
    try {
      const res = await api.post("/auth/resend-otp", { pendingToken });
      setPendingToken(res.data.pendingToken);
      setOtp(Array(OTP_LENGTH).fill(""));
      setError("");
    } catch {
      setError("Could not resend code");
    } finally { setResending(false); }
  };

  return (
    <LinearGradient colors={["#0F2560", "#0F172A"]} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => step === "otp" ? setStep("form") : router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </Pressable>

          {step === "form" ? (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Join Tarea for free today</Text>
              </View>

              <View style={styles.form}>
                {/* Role selector */}
                <View style={styles.roleRow}>
                  {[
                    { value: "CUSTOMER", label: "I need a Handyman", icon: "person" },
                    { value: "HANDYMAN", label: "I'm a Handyman", icon: "construct" },
                  ].map(({ value, label, icon }) => (
                    <Pressable key={value}
                      style={[styles.roleBtn, role === value && styles.roleBtnActive]}
                      onPress={() => setValue("role", value as "CUSTOMER" | "HANDYMAN")}>
                      <Ionicons name={icon as "person" | "construct"} size={18} color={role === value ? colors.ink : colors.inkSubtle} />
                      <Text style={[styles.roleBtnText, role === value && styles.roleBtnTextActive]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>

                {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

                {/* Name */}
                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>Full name</Text>
                  <Controller control={control} name="name" render={({ field: { onChange, value } }) => (
                    <TextInput style={[styles.input, errors.name && styles.inputError]}
                      placeholder="John Smith" placeholderTextColor={colors.inkSubtle}
                      autoCapitalize="words" value={value} onChangeText={onChange} />
                  )} />
                  {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}
                </View>

                {/* Email */}
                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>Email</Text>
                  <Controller control={control} name="email" render={({ field: { onChange, value } }) => (
                    <TextInput style={[styles.input, errors.email && styles.inputError]}
                      placeholder="you@example.com" placeholderTextColor={colors.inkSubtle}
                      keyboardType="email-address" autoCapitalize="none" value={value} onChangeText={onChange} />
                  )} />
                  {errors.email && <Text style={styles.error}>{errors.email.message}</Text>}
                </View>

                {/* Phone */}
                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>Phone number</Text>
                  <Controller control={control} name="phone" render={({ field: { onChange, value } }) => (
                    <TextInput style={[styles.input, errors.phone && styles.inputError]}
                      placeholder="(555) 123-4567" placeholderTextColor={colors.inkSubtle}
                      keyboardType="phone-pad" value={value} onChangeText={onChange} />
                  )} />
                  {errors.phone && <Text style={styles.error}>{errors.phone.message}</Text>}
                </View>

                {/* Password */}
                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.pwWrap}>
                    <Controller control={control} name="password" render={({ field: { onChange, value } }) => (
                      <TextInput style={[styles.input, styles.pwInput, errors.password && styles.inputError]}
                        placeholder="Min. 8 characters" placeholderTextColor={colors.inkSubtle}
                        secureTextEntry={!showPw} value={value} onChangeText={onChange} />
                    )} />
                    <Pressable style={styles.eyeBtn} onPress={() => setShowPw(!showPw)}>
                      <Ionicons name={showPw ? "eye-off" : "eye"} size={20} color={colors.inkSubtle} />
                    </Pressable>
                  </View>
                  {errors.password && <Text style={styles.error}>{errors.password.message}</Text>}
                </View>

                <Pressable
                  style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }, loading && { opacity: 0.7 }]}
                  onPress={handleSubmit(onSubmit)} disabled={loading}>
                  <Text style={styles.btnPrimaryText}>{loading ? "Creating account…" : "Create Account"}</Text>
                </Pressable>

                <View style={styles.otpNote}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={colors.inkSubtle} />
                  <Text style={styles.otpNoteText}>A verification code will be sent to your phone</Text>
                </View>

                <View style={styles.footer}>
                  <Text style={styles.footerText}>Already have an account? </Text>
                  <Pressable onPress={() => router.push("/(auth)/login")}>
                    <Text style={styles.link}>Sign in</Text>
                  </Pressable>
                </View>
              </View>
            </>
          ) : (
            /* OTP step */
            <View style={styles.otpContainer}>
              <View style={styles.otpIcon}>
                <Ionicons name="phone-portrait-outline" size={40} color={colors.skyBlue} />
              </View>
              <Text style={styles.title}>Verify your phone</Text>
              <Text style={styles.otpSubtitle}>Enter the 6-digit code we sent to your number</Text>

              {error ? <Text style={[styles.errorBanner, { marginBottom: 16 }]}>{error}</Text> : null}

              <View style={styles.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={el => { inputRefs.current[i] = el; }}
                    style={[styles.otpInput, digit && styles.otpInputFilled]}
                    value={digit}
                    onChangeText={v => handleDigit(i, v)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                  />
                ))}
              </View>

              <Pressable
                style={({ pressed }) => [styles.btnPrimary, { marginTop: 8 }, pressed && { opacity: 0.85 }, loading && { opacity: 0.7 }]}
                onPress={() => verifyOtp(otp.join(""))}
                disabled={loading || otp.some(d => !d)}>
                <Text style={styles.btnPrimaryText}>{loading ? "Verifying…" : "Verify & Continue"}</Text>
              </Pressable>

              <Pressable onPress={resendOtp} disabled={resending} style={styles.resendBtn}>
                <Text style={styles.resendText}>{resending ? "Sending…" : "Resend code"}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 40 },
  back: { marginBottom: spacing.xl },
  header: { marginBottom: spacing.xl },
  title: { fontSize: fontSize["3xl"], fontWeight: "800", color: colors.white, marginBottom: 6 },
  subtitle: { fontSize: fontSize.base, color: "rgba(255,255,255,0.5)" },
  form: { gap: spacing.lg },
  roleRow: { flexDirection: "row", gap: spacing.sm, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: radius.lg, padding: 4 },
  roleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: radius.md },
  roleBtnActive: { backgroundColor: colors.skyBlue, shadowColor: colors.skyBlue, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
  roleBtnText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.inkSubtle },
  roleBtnTextActive: { color: colors.ink },
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
  otpNote: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" },
  otpNoteText: { color: "rgba(255,255,255,0.35)", fontSize: fontSize.xs },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 8 },
  footerText: { color: "rgba(255,255,255,0.45)", fontSize: fontSize.sm },
  link: { color: colors.skyBlue, fontSize: fontSize.sm, fontWeight: "700" },
  // OTP step
  otpContainer: { flex: 1, alignItems: "center", paddingTop: 40, gap: spacing.lg },
  otpIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(56,189,248,0.1)", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  otpSubtitle: { color: "rgba(255,255,255,0.5)", fontSize: fontSize.base, textAlign: "center", marginBottom: 8 },
  otpRow: { flexDirection: "row", gap: 10, marginVertical: 8 },
  otpInput: { width: 46, height: 56, borderRadius: radius.md, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.06)", textAlign: "center", fontSize: 22, fontWeight: "700", color: colors.white },
  otpInputFilled: { borderColor: colors.skyBlue, backgroundColor: "rgba(56,189,248,0.1)" },
  resendBtn: { marginTop: 8, padding: spacing.sm },
  resendText: { color: colors.skyBlue, fontSize: fontSize.sm, fontWeight: "600", textAlign: "center" },
});

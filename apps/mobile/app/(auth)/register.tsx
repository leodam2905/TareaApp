import { useState } from "react";
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
  name: z.string().min(2),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Min. 8 characters"),
  role: z.enum(["CUSTOMER", "HANDYMAN"]),
});
type FormData = z.infer<typeof schema>;

export default function RegisterScreen() {
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: "CUSTOMER" },
  });
  const role = watch("role");

  const onSubmit = async (data: FormData) => {
    setLoading(true); setError("");
    try {
      const res = await api.post("/auth/register", data);
      await SecureStore.setItemAsync("tarea_token", res.data.token || "");
      await SecureStore.setItemAsync("tarea_role", res.data.role);
      await SecureStore.setItemAsync("tarea_user", JSON.stringify(res.data));
      router.replace(data.role === "HANDYMAN" ? "/(handyman)/tabs/dashboard" : "/(customer)/tabs/dashboard");
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } }).response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#0F2560", "#0F172A"]} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </Pressable>

          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join Tarea for free today</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.form}>
            {/* Role selector */}
            <View style={styles.roleRow}>
              {[{ value: "CUSTOMER", label: "I need a Handyman", icon: "person" }, { value: "HANDYMAN", label: "I'm a Handyman", icon: "construct" }].map(({ value, label, icon }) => (
                <Pressable key={value} style={[styles.roleBtn, role === value && styles.roleBtnActive]} onPress={() => setValue("role", value as "CUSTOMER" | "HANDYMAN")}>
                  <Ionicons name={icon as "person" | "construct"} size={18} color={role === value ? colors.ink : colors.inkSubtle} />
                  <Text style={[styles.roleBtnText, role === value && styles.roleBtnTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

            {[
              { name: "name" as const, label: "Full name", placeholder: "John Smith" },
              { name: "email" as const, label: "Email", placeholder: "you@example.com", keyboardType: "email-address" as const },
            ].map(({ name, label, placeholder, keyboardType }) => (
              <View key={name} style={styles.fieldWrap}>
                <Text style={styles.label}>{label}</Text>
                <Controller control={control} name={name} render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, errors[name] && styles.inputError]}
                    placeholder={placeholder}
                    placeholderTextColor={colors.inkSubtle}
                    keyboardType={keyboardType}
                    autoCapitalize={name === "email" ? "none" : "words"}
                    value={value}
                    onChangeText={onChange}
                  />
                )} />
                {errors[name] && <Text style={styles.error}>{errors[name]?.message}</Text>}
              </View>
            ))}

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.pwWrap}>
                <Controller control={control} name="password" render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, styles.pwInput, errors.password && styles.inputError]}
                    placeholder="Min. 8 characters"
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
              <Text style={styles.btnPrimaryText}>{loading ? "Creating account..." : "Create Account"}</Text>
            </Pressable>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Pressable onPress={() => router.push("/(auth)/login")}>
                <Text style={styles.link}>Sign in</Text>
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
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 8 },
  footerText: { color: "rgba(255,255,255,0.45)", fontSize: fontSize.sm },
  link: { color: colors.skyBlue, fontSize: fontSize.sm, fontWeight: "700" },
});

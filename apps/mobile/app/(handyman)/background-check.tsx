import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { api } from "../../constants/api";
import { colors, fontSize, radius, spacing } from "../../constants/theme";

const FEE = 29.99;

export default function BackgroundCheckScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    api.get("/handyman/background-check")
      .then(res => {
        setStatus(res.data.status);
        // Already paid or in progress — skip to dashboard
        if (["PAID", "IN_PROGRESS", "PASSED"].includes(res.data.status)) {
          router.replace("/(handyman)/tabs/dashboard");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const payNow = async () => {
    setSubmitting(true);
    try {
      const res = await api.post("/handyman/background-check", { method: "now" });
      if (res.data.checkoutUrl) {
        await WebBrowser.openBrowserAsync(res.data.checkoutUrl);
        // Re-check status after browser closes
        const updated = await api.get("/handyman/background-check");
        setStatus(updated.data.status);
        if (["PAID", "IN_PROGRESS", "PASSED", "DEFERRED"].includes(updated.data.status)) {
          router.replace("/(handyman)/tabs/dashboard");
        }
      } else if (res.data.status) {
        // Already handled
        router.replace("/(handyman)/tabs/dashboard");
      } else {
        Alert.alert("Error", "Could not start payment. Please try again.");
      }
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    }
    setSubmitting(false);
  };

  const payLater = async () => {
    setSubmitting(true);
    try {
      await api.post("/handyman/background-check", { method: "deferred" });
      Alert.alert(
        "Got it!",
        `$${FEE.toFixed(2)} will be deducted from your first payout. You can start receiving bookings while your background check is pending.`,
        [{ text: "Continue", onPress: () => router.replace("/(handyman)/tabs/dashboard") }]
      );
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.skyBlue} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={["#0F2560", "#0F172A"]} style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark" size={32} color={colors.skyBlue} />
        </View>
        <Text style={styles.title}>Background Check Required</Text>
        <Text style={styles.subtitle}>
          All Tarea handymen must pass a background check before accepting bookings.
          This protects customers and builds trust.
        </Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* Fee highlight */}
        <View style={styles.feeCard}>
          <Text style={styles.feeLabel}>One-time fee</Text>
          <Text style={styles.feeAmount}>${FEE.toFixed(2)}</Text>
          <Text style={styles.feeSub}>Powered by Certn · Typically completes in 1–3 business days</Text>
        </View>

        {/* What's included */}
        <View style={styles.includesCard}>
          <Text style={styles.includesTitle}>What's included</Text>
          {[
            "Criminal history check",
            "Sex offender registry search",
            "Global watchlist screening",
            "Identity verification",
          ].map(item => (
            <View key={item} style={styles.includesRow}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.includesText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Pay Now */}
        <Pressable
          style={({ pressed }) => [styles.optionCard, styles.optionPrimary, pressed && { opacity: 0.85 }, submitting && { opacity: 0.6 }]}
          onPress={payNow}
          disabled={submitting}
        >
          <View style={styles.optionIcon}>
            <Ionicons name="card" size={22} color={colors.skyBlue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Pay now — ${FEE.toFixed(2)}</Text>
            <Text style={styles.optionSub}>Pay by card via Stripe. Your check starts immediately.</Text>
          </View>
          {submitting ? <ActivityIndicator color={colors.skyBlue} size="small" /> : <Ionicons name="chevron-forward" size={18} color={colors.skyBlue} />}
        </Pressable>

        {/* Deduct later */}
        <Pressable
          style={({ pressed }) => [styles.optionCard, pressed && { opacity: 0.85 }, submitting && { opacity: 0.6 }]}
          onPress={payLater}
          disabled={submitting}
        >
          <View style={[styles.optionIcon, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
            <Ionicons name="time" size={22} color={colors.inkSubtle} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.optionTitle, { color: colors.white }]}>Deduct from first payout</Text>
            <Text style={styles.optionSub}>Start working now. ${FEE.toFixed(2)} is deducted from your first cashout.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.inkSubtle} />
        </Pressable>

        <Text style={styles.disclaimer}>
          You can accept bookings while your check is processing. Results are shared only with Tarea and never with customers.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  header: { paddingTop: 80, paddingBottom: 32, paddingHorizontal: spacing.xl, alignItems: "center" },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(56,189,248,0.15)", borderWidth: 1, borderColor: "rgba(56,189,248,0.3)", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  title: { fontSize: fontSize["2xl"], fontWeight: "900", color: colors.white, textAlign: "center", marginBottom: 10 },
  subtitle: { fontSize: fontSize.sm, color: colors.inkSubtle, textAlign: "center", lineHeight: 20 },
  content: { flex: 1, padding: spacing.xl, gap: spacing.md },
  feeCard: { backgroundColor: "rgba(56,189,248,0.1)", borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: "rgba(56,189,248,0.25)", alignItems: "center" },
  feeLabel: { fontSize: fontSize.xs, color: colors.skyBlue, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  feeAmount: { fontSize: 40, fontWeight: "900", color: colors.white, marginVertical: 4 },
  feeSub: { fontSize: fontSize.xs, color: colors.inkSubtle, textAlign: "center" },
  includesCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.cardBorder, gap: spacing.sm },
  includesTitle: { fontSize: fontSize.sm, fontWeight: "700", color: colors.white, marginBottom: 2 },
  includesRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  includesText: { fontSize: fontSize.sm, color: "rgba(255,255,255,0.7)" },
  optionCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.cardBorder, flexDirection: "row", alignItems: "center", gap: spacing.md },
  optionPrimary: { borderColor: "rgba(56,189,248,0.4)", backgroundColor: "rgba(56,189,248,0.08)" },
  optionIcon: { width: 44, height: 44, borderRadius: radius.lg, backgroundColor: "rgba(56,189,248,0.15)", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  optionTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.skyBlue, marginBottom: 2 },
  optionSub: { fontSize: fontSize.xs, color: colors.inkSubtle, lineHeight: 17 },
  disclaimer: { fontSize: fontSize.xs, color: "rgba(255,255,255,0.3)", textAlign: "center", lineHeight: 17 },
});

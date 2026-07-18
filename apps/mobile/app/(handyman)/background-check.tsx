import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Linking } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";
import BackBar from "@/components/ui/BackBar";
import { SafeAreaView } from "react-native-safe-area-context";

const PENDING_STATUSES = ["DEFERRED", "PAID", "IN_PROGRESS"];

export default function BackgroundCheckScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus]   = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Load current status so we can show pending/complete instead of the pay options.
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/handyman/background-check");
        if (res.ok) setStatus((await res.json()).status ?? null);
      } catch { /* ignore — show pay options */ }
      setChecking(false);
    })();
  }, []);

  const choose = async (method: "now" | "deferred") => {
    setLoading(true);
    const res = await api.post("/handyman/background-check", { method });
    if (res.ok) {
      const data = await res.json();
      if (method === "now" && data.checkoutUrl) {
        await Linking.openURL(data.checkoutUrl);
      } else {
        Alert.alert("Got it!", "$29.99 will be deducted from your first payout.", [
          { text: "Go to Dashboard", onPress: () => router.replace("/(handyman)/tabs/dashboard") },
        ]);
      }
    } else {
      Alert.alert("Error", "Something went wrong. Try again.");
    }
    setLoading(false);
  };

  if (checking) {
    return <View style={s.center}><ActivityIndicator color={C.sky} size="large" /></View>;
  }

  const isComplete = status === "PASSED";
  const isPending  = !!status && PENDING_STATUSES.includes(status);
  const isFailed   = status === "FAILED";

  // Already initiated or approved — show status instead of the pay options.
  if (isComplete || isPending || isFailed) {
    return (
      <SafeAreaView style={s.safe}>
        <BackBar />
        <View style={s.container}>
          <Text style={s.title}>Background Check</Text>
          <View style={[s.statusCard,
            isComplete ? s.statusComplete : isFailed ? s.statusFailed : s.statusPending]}>
            <Text style={s.statusEmoji}>{isComplete ? "✅" : isFailed ? "⚠️" : "⏳"}</Text>
            <Text style={s.statusTitle}>
              {isComplete ? "Background Check Complete" : isFailed ? "Background Check Not Passed" : "Background Check Pending"}
            </Text>
            <Text style={s.statusText}>
              {isComplete
                ? "You've been approved by Tarea. You're fully verified and can receive bookings."
                : isFailed
                ? "Your background check was not approved. Please contact support@taptarea.com for next steps."
                : "Payment received. Your check is under review — this usually takes 1–3 business days. You can accept jobs while it processes."}
            </Text>
          </View>
          <TouchableOpacity style={s.doneBtn} onPress={() => router.replace("/(handyman)/tabs/dashboard")}>
            <Text style={s.doneBtnText}>Go to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <BackBar />
      <View style={s.container}>
        <Text style={s.title}>Background Check</Text>
        <Text style={s.sub}>Required before you can receive job requests from customers.</Text>

        <View style={s.infoCard}>
          <Text style={s.infoEmoji}>🛡️</Text>
          <Text style={s.infoText}>All Tarea handymen must pass a background check. This protects customers and builds trust. One-time fee: <Text style={s.infoBold}>$29.99</Text></Text>
        </View>

        {/* Pay now */}
        <TouchableOpacity style={s.optionCard} onPress={() => choose("now")} disabled={loading}>
          <View style={s.optionIcon}><Text style={{ fontSize: 24 }}>💳</Text></View>
          <View style={s.optionBody}>
            <Text style={s.optionTitle}>Pay Now — $29.99</Text>
            <Text style={s.optionDesc}>Pay by card via Stripe. Check starts immediately and typically completes in 1–3 business days.</Text>
          </View>
        </TouchableOpacity>

        {/* Deferred */}
        <TouchableOpacity style={[s.optionCard, s.optionCardSecondary]} onPress={() => choose("deferred")} disabled={loading}>
          <View style={[s.optionIcon, s.optionIconSecondary]}><Text style={{ fontSize: 24 }}>⏳</Text></View>
          <View style={s.optionBody}>
            <Text style={s.optionTitle}>Deduct from First Payout</Text>
            <Text style={s.optionDesc}>Start working now. The $29.99 fee will be automatically deducted from your first cashout.</Text>
          </View>
        </TouchableOpacity>

        {loading && <ActivityIndicator color={C.sky} style={{ marginTop: 16 }} />}

        <Text style={s.note}>You can accept bookings while your check is processing. Tarea uses Checkr for all background screenings.</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:                { flex: 1, backgroundColor: C.bg },
  center:              { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  container:           { flex: 1, padding: 24, gap: 16 },
  title:               { color: C.text, fontSize: 26, fontWeight: "900" },
  statusCard:          { borderRadius: 18, padding: 22, borderWidth: 1, alignItems: "center", gap: 10, marginTop: 8 },
  statusComplete:      { backgroundColor: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.3)" },
  statusPending:       { backgroundColor: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.35)" },
  statusFailed:        { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.35)" },
  statusEmoji:         { fontSize: 44 },
  statusTitle:         { color: C.text, fontSize: 19, fontWeight: "800", textAlign: "center" },
  statusText:          { color: C.textMuted, fontSize: 14, lineHeight: 21, textAlign: "center" },
  doneBtn:             { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 4 },
  doneBtnText:         { color: C.ink, fontWeight: "800", fontSize: 16 },
  sub:                 { color: C.textMuted, fontSize: 14, lineHeight: 20 },
  infoCard:            { flexDirection: "row", gap: 14, backgroundColor: "rgba(56,189,248,0.08)", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(56,189,248,0.15)", alignItems: "flex-start" },
  infoEmoji:           { fontSize: 28 },
  infoText:            { flex: 1, color: C.textMuted, fontSize: 14, lineHeight: 20 },
  infoBold:            { color: C.text, fontWeight: "700" },
  optionCard:          { flexDirection: "row", gap: 14, backgroundColor: C.surface, borderRadius: 18, padding: 18, borderWidth: 2, borderColor: C.sky, alignItems: "flex-start" },
  optionCardSecondary: { borderColor: C.line },
  optionIcon:          { width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(56,189,248,0.15)", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  optionIconSecondary: { backgroundColor: C.surface },
  optionBody:          { flex: 1 },
  optionTitle:         { color: C.text, fontWeight: "800", fontSize: 16, marginBottom: 4 },
  optionDesc:          { color: C.textMuted, fontSize: 13, lineHeight: 19 },
  note:                { color: C.slate600, fontSize: 12, textAlign: "center", lineHeight: 18 },
});

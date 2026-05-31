import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Linking, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { API_BASE } from "@/lib/api";
import { C } from "@/constants/colors";
import { SafeAreaView } from "react-native-safe-area-context";

type EarningsData = { totalEarnings: number; pendingEarnings: number; totalJobs: number; stripeAccountStatus: string | null; stripeOnboardingUrl?: string };

export default function EarningsScreen() {
  const [data, setData]         = useState<EarningsData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get("/handyman/earnings");
    if (res.ok) setData(await res.json());
    setLoading(false); setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const connectStripe = async () => {
    setConnecting(true);
    try {
      const res = await api.post("/stripe/connect", {});
      if (res.ok) {
        const { url } = await res.json();
        if (url) await Linking.openURL(url);
      } else {
        Alert.alert("Error", "Could not start Stripe setup. Try again.");
      }
    } catch {
      Alert.alert("Error", "Network error.");
    }
    setConnecting(false);
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={C.sky} size="large" /></View>;

  const stripeActive = data?.stripeAccountStatus === "active";

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.sky} />}>
        <View style={s.header}>
          <Text style={s.title}>Earnings</Text>
        </View>

        {/* Stats */}
        <View style={s.statsCol}>
          <View style={s.bigStat}>
            <Text style={s.bigLabel}>Total Earned</Text>
            <Text style={s.bigValue}>${(data?.totalEarnings ?? 0).toFixed(2)}</Text>
          </View>
          <View style={s.statsRow}>
            <View style={[s.statCard, { flex: 1 }]}>
              <Text style={s.statLabel}>Pending</Text>
              <Text style={[s.statValue, { color: C.amber }]}>${(data?.pendingEarnings ?? 0).toFixed(2)}</Text>
            </View>
            <View style={[s.statCard, { flex: 1 }]}>
              <Text style={s.statLabel}>Jobs Done</Text>
              <Text style={[s.statValue, { color: C.sky }]}>{data?.totalJobs ?? 0}</Text>
            </View>
          </View>
        </View>

        {/* Stripe */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Payout Account</Text>
          {stripeActive ? (
            <View style={s.stripeActive}>
              <Text style={s.stripeActiveEmoji}>✅</Text>
              <View>
                <Text style={s.stripeActiveTitle}>Stripe Connected</Text>
                <Text style={s.stripeActiveSub}>Payouts are sent within 30 min of job completion</Text>
              </View>
            </View>
          ) : (
            <View style={s.stripeSetup}>
              <Text style={s.stripeSetupText}>Connect your bank account via Stripe to receive payouts for completed jobs.</Text>
              <TouchableOpacity style={[s.stripeBtn, connecting && s.stripeBtnDisabled]} onPress={connectStripe} disabled={connecting}>
                <Text style={s.stripeBtnText}>{connecting ? "Opening Stripe…" : "Connect Stripe →"}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: C.ink },
  scroll:            { flex: 1 },
  center:            { flex: 1, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  header:            { padding: 24, paddingBottom: 12 },
  title:             { color: C.white, fontSize: 28, fontWeight: "900" },
  statsCol:          { padding: 16, gap: 10 },
  bigStat:           { backgroundColor: "#1E293B", borderRadius: 20, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  bigLabel:          { color: C.slate400, fontSize: 14, fontWeight: "600" },
  bigValue:          { color: C.emerald, fontSize: 44, fontWeight: "900", marginTop: 4 },
  statsRow:          { flexDirection: "row", gap: 10 },
  statCard:          { backgroundColor: "#1E293B", borderRadius: 16, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  statLabel:         { color: C.slate400, fontSize: 12 },
  statValue:         { fontSize: 24, fontWeight: "900", marginTop: 4 },
  card:              { margin: 16, backgroundColor: "#1E293B", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  cardTitle:         { color: C.white, fontWeight: "800", fontSize: 16, marginBottom: 14 },
  stripeActive:      { flexDirection: "row", alignItems: "center", gap: 14 },
  stripeActiveEmoji: { fontSize: 28 },
  stripeActiveTitle: { color: C.emerald, fontWeight: "700", fontSize: 15 },
  stripeActiveSub:   { color: C.slate400, fontSize: 12, marginTop: 2 },
  stripeSetup:       { gap: 14 },
  stripeSetupText:   { color: C.slate400, fontSize: 14, lineHeight: 20 },
  stripeBtn:         { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  stripeBtnDisabled: { opacity: 0.5 },
  stripeBtnText:     { color: C.ink, fontWeight: "800", fontSize: 15 },
});

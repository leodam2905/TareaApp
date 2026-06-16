import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Linking, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";
import { SafeAreaView } from "react-native-safe-area-context";

const WEB_PAYOUT_URL = "https://taptarea.com/handyman/payout-methods";

type EarningsData = { totalEarnings: number; pendingEarnings: number; totalJobs: number; stripeAccountStatus: string | null };
type Card         = { id: string; brand: string; last4: string; expMonth: number; expYear: number; funding: string; isDefault: boolean };
type Bank         = { id: string; bankName: string | null; last4: string; routingNumber: string | null; isDefault: boolean };
type Methods      = { cards: Card[]; banks: Bank[] };

export default function EarningsScreen() {
  const [data, setData]         = useState<EarningsData | null>(null);
  const [methods, setMethods]   = useState<Methods | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(async () => {
    const [earningsRes, methodsRes] = await Promise.all([
      api.get("/handyman/earnings"),
      api.get("/handyman/payout-methods"),
    ]);
    if (earningsRes.ok) setData(await earningsRes.json());
    if (methodsRes.ok)  setMethods(await methodsRes.json());
    setLoading(false);
    setRefreshing(false);
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

  const openManageMethods = () => Linking.openURL(WEB_PAYOUT_URL);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.sky} size="large" /></View>;

  const stripeActive = data?.stripeAccountStatus === "active";
  const debitCards   = (methods?.cards ?? []).filter(c => c.funding === "debit");
  const banks        = methods?.banks ?? [];
  const hasNoMethods = debitCards.length === 0 && banks.length === 0;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.sky} />}
      >
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

        {/* Payout Methods */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Payout Methods</Text>
            <TouchableOpacity onPress={openManageMethods} style={s.manageBtn}>
              <Text style={s.manageBtnText}>Manage →</Text>
            </TouchableOpacity>
          </View>

          {/* Stripe identity status */}
          {!stripeActive ? (
            <View style={s.stripeSetup}>
              <Text style={s.stripeSetupText}>
                Verify your identity with Stripe to enable payouts and add payout methods.
              </Text>
              <TouchableOpacity
                style={[s.stripeBtn, connecting && s.stripeBtnDisabled]}
                onPress={connectStripe}
                disabled={connecting}
              >
                <Text style={s.stripeBtnText}>{connecting ? "Opening Stripe…" : "Verify Identity →"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Info chips */}
              <View style={s.infoRow}>
                <View style={[s.infoChip, { borderColor: "#7C3AED44", backgroundColor: "#7C3AED11" }]}>
                  <Text style={[s.infoChipText, { color: "#A78BFA" }]}>⚡ Debit — Instant (1% fee)</Text>
                </View>
                <View style={[s.infoChip, { borderColor: "#38BDF844", backgroundColor: "#38BDF811" }]}>
                  <Text style={[s.infoChipText, { color: C.sky }]}>🏦 Bank — Weekly, free</Text>
                </View>
              </View>

              {/* Debit cards */}
              {debitCards.length > 0 && (
                <View style={s.methodSection}>
                  <Text style={s.methodSectionLabel}>DEBIT CARDS</Text>
                  {debitCards.map(card => (
                    <View key={card.id} style={s.methodRow}>
                      <View style={[s.methodIcon, { backgroundColor: "#7C3AED11", borderColor: "#7C3AED44" }]}>
                        <Text style={{ fontSize: 16 }}>💳</Text>
                      </View>
                      <View style={s.methodInfo}>
                        <Text style={s.methodName}>{card.brand} ···· {card.last4}</Text>
                        <Text style={s.methodSub}>Expires {card.expMonth}/{card.expYear}</Text>
                      </View>
                      {card.isDefault && (
                        <View style={s.defaultBadge}>
                          <Text style={s.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Bank accounts */}
              {banks.length > 0 && (
                <View style={s.methodSection}>
                  <Text style={s.methodSectionLabel}>BANK ACCOUNTS</Text>
                  {banks.map(bank => (
                    <View key={bank.id} style={s.methodRow}>
                      <View style={[s.methodIcon, { backgroundColor: "#38BDF811", borderColor: "#38BDF844" }]}>
                        <Text style={{ fontSize: 16 }}>🏦</Text>
                      </View>
                      <View style={s.methodInfo}>
                        <Text style={s.methodName}>{bank.bankName ?? "Bank"} ···· {bank.last4}</Text>
                        {bank.routingNumber && (
                          <Text style={s.methodSub}>Routing ···{bank.routingNumber.slice(-4)}</Text>
                        )}
                      </View>
                      {bank.isDefault && (
                        <View style={s.defaultBadge}>
                          <Text style={s.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Empty state */}
              {hasNoMethods && (
                <View style={s.emptyMethods}>
                  <Text style={s.emptyMethodsText}>No payout methods added yet.</Text>
                  <TouchableOpacity onPress={openManageMethods} style={s.addMethodBtn}>
                    <Text style={s.addMethodBtnText}>+ Add Debit Card or Bank Account</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: C.ink },
  scroll:             { flex: 1 },
  center:             { flex: 1, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  header:             { padding: 24, paddingBottom: 12 },
  title:              { color: C.white, fontSize: 28, fontWeight: "900" },
  statsCol:           { padding: 16, gap: 10 },
  bigStat:            { backgroundColor: "#1E293B", borderRadius: 20, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  bigLabel:           { color: C.slate400, fontSize: 14, fontWeight: "600" },
  bigValue:           { color: C.emerald, fontSize: 44, fontWeight: "900", marginTop: 4 },
  statsRow:           { flexDirection: "row", gap: 10 },
  statCard:           { backgroundColor: "#1E293B", borderRadius: 16, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  statLabel:          { color: C.slate400, fontSize: 12 },
  statValue:          { fontSize: 24, fontWeight: "900", marginTop: 4 },
  card:               { margin: 16, backgroundColor: "#1E293B", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  cardHeader:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  cardTitle:          { color: C.white, fontWeight: "800", fontSize: 16 },
  manageBtn:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: "rgba(56,189,248,0.3)", backgroundColor: "rgba(56,189,248,0.08)" },
  manageBtnText:      { color: C.sky, fontSize: 12, fontWeight: "700" },
  stripeSetup:        { gap: 14 },
  stripeSetupText:    { color: C.slate400, fontSize: 14, lineHeight: 20 },
  stripeBtn:          { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  stripeBtnDisabled:  { opacity: 0.5 },
  stripeBtnText:      { color: C.ink, fontWeight: "800", fontSize: 15 },
  infoRow:            { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  infoChip:           { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  infoChipText:       { fontSize: 12, fontWeight: "600" },
  methodSection:      { marginBottom: 14 },
  methodSectionLabel: { color: C.slate500, fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 8 },
  methodRow:          { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  methodIcon:         { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  methodInfo:         { flex: 1 },
  methodName:         { color: C.white, fontWeight: "700", fontSize: 14 },
  methodSub:          { color: C.slate400, fontSize: 11, marginTop: 1 },
  defaultBadge:       { backgroundColor: "rgba(16,185,129,0.12)", borderWidth: 1, borderColor: "rgba(16,185,129,0.25)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  defaultBadgeText:   { color: C.emerald, fontSize: 10, fontWeight: "700" },
  emptyMethods:       { alignItems: "center", paddingVertical: 16, gap: 12 },
  emptyMethodsText:   { color: C.slate400, fontSize: 14 },
  addMethodBtn:       { backgroundColor: "rgba(56,189,248,0.1)", borderWidth: 1, borderColor: "rgba(56,189,248,0.3)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  addMethodBtnText:   { color: C.sky, fontWeight: "700", fontSize: 13 },
});

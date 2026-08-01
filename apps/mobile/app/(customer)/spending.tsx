import { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BackBar from "@/components/ui/BackBar";
import { useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";

type Booking = {
  id: string;
  status: string;
  totalPrice: number;
  scheduledAt: string;
  service: { title: string; category: string };
  handyman: { name: string };
};

const CATEGORY_EMOJI: Record<string, string> = {
  PLUMBING: "🔧", ELECTRICAL: "⚡", CARPENTRY: "🪚", PAINTING: "🎨",
  CLEANING: "🧹", HVAC: "❄️", ROOFING: "🏠", LANDSCAPING: "🌿",
  MOVING: "📦", APPLIANCE_REPAIR: "🔌", GENERAL: "🛠️",
};

export default function SpendingScreen() {
  const [bookings,   setBookings]   = useState<Booking[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get("/bookings?role=customer");
    if (res.ok) {
      const all: Booking[] = await res.json();
      setBookings(all.filter(b => b.status === "COMPLETED"));
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const total = bookings.reduce((sum, b) => sum + (b.totalPrice ?? 0), 0);

  // Spending by category
  const byCategory: Record<string, number> = {};
  for (const b of bookings) {
    const cat = b.service?.category ?? "GENERAL";
    byCategory[cat] = (byCategory[cat] ?? 0) + (b.totalPrice ?? 0);
  }
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Spending by month
  const byMonth: Record<string, number> = {};
  for (const b of bookings) {
    const key = new Date(b.scheduledAt).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    byMonth[key] = (byMonth[key] ?? 0) + (b.totalPrice ?? 0);
  }
  const months = Object.entries(byMonth).slice(-6).reverse();

  const maxMonth = Math.max(...months.map(([, v]) => v), 1);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.sky} size="large" /></View>;

  return (
    <SafeAreaView style={s.safe}>
      <BackBar fallback="/(customer)/tabs/dashboard" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.sky} />}
      >
        <View style={s.header}>
          <Text style={s.title}>Spending Report</Text>
          <Text style={s.sub}>Based on completed bookings</Text>
        </View>

        {/* Total */}
        <View style={s.totalCard}>
          <Text style={s.totalLabel}>Total Spent</Text>
          <Text style={s.totalValue}>${total.toFixed(2)}</Text>
          <Text style={s.totalSub}>{bookings.length} completed job{bookings.length !== 1 ? "s" : ""}</Text>
        </View>

        {bookings.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>💰</Text>
            <Text style={s.emptyText}>No completed bookings yet</Text>
          </View>
        ) : (
          <>
            {/* By Category */}
            {topCategories.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Spending by Category</Text>
                {topCategories.map(([cat, amount]) => (
                  <View key={cat} style={s.catRow}>
                    <Text style={s.catEmoji}>{CATEGORY_EMOJI[cat] ?? "🛠️"}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={s.catHeader}>
                        <Text style={s.catName}>{cat.replace(/_/g, " ")}</Text>
                        <Text style={s.catAmount}>${amount.toFixed(2)}</Text>
                      </View>
                      <View style={s.barBg}>
                        <View style={[s.barFill, { width: `${(amount / total) * 100}%` as any }]} />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* By Month */}
            {months.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Monthly Breakdown</Text>
                {months.map(([month, amount]) => (
                  <View key={month} style={s.monthRow}>
                    <Text style={s.monthLabel}>{month}</Text>
                    <View style={s.monthBarBg}>
                      <View style={[s.monthBarFill, { width: `${(amount / maxMonth) * 100}%` as any }]} />
                    </View>
                    <Text style={s.monthAmount}>${amount.toFixed(0)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Recent Transactions */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Recent Transactions</Text>
              {bookings.slice(0, 8).map(b => (
                <View key={b.id} style={s.txRow}>
                  <Text style={s.txEmoji}>{CATEGORY_EMOJI[b.service?.category] ?? "🛠️"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.txTitle}>{b.service?.title}</Text>
                    <Text style={s.txMeta}>{b.handyman?.name} · {new Date(b.scheduledAt).toLocaleDateString()}</Text>
                  </View>
                  <Text style={s.txAmount}>-${(b.totalPrice ?? 0).toFixed(2)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: "#FFFFFF" },
  center:        { flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  header:        { padding: 24, paddingBottom: 8 },
  title:         { color: "#0F172A", fontSize: 26, fontWeight: "900" },
  sub:           { color: "#64748B", fontSize: 13, marginTop: 2 },
  totalCard:     { margin: 16, backgroundColor: "#F1F5F9", borderRadius: 20, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0" },
  totalLabel:    { color: "#64748B", fontSize: 13, fontWeight: "600" },
  totalValue:    { color: C.emerald, fontSize: 48, fontWeight: "900", marginTop: 4 },
  totalSub:      { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  card:          { margin: 16, marginTop: 0, backgroundColor: "#F1F5F9", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", gap: 12 },
  cardTitle:     { color: "#0F172A", fontWeight: "800", fontSize: 15, marginBottom: 4 },
  catRow:        { flexDirection: "row", alignItems: "center", gap: 10 },
  catEmoji:      { fontSize: 20, width: 28 },
  catHeader:     { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  catName:       { color: "#334155", fontSize: 13, fontWeight: "600" },
  catAmount:     { color: "#0F172A", fontSize: 13, fontWeight: "700" },
  barBg:         { height: 6, backgroundColor: "#E2E8F0", borderRadius: 3 },
  barFill:       { height: 6, backgroundColor: C.sky, borderRadius: 3 },
  monthRow:      { flexDirection: "row", alignItems: "center", gap: 10 },
  monthLabel:    { color: "#64748B", fontSize: 12, width: 70 },
  monthBarBg:    { flex: 1, height: 8, backgroundColor: "#E2E8F0", borderRadius: 4 },
  monthBarFill:  { height: 8, backgroundColor: C.emerald, borderRadius: 4 },
  monthAmount:   { color: "#0F172A", fontSize: 12, fontWeight: "700", width: 44, textAlign: "right" },
  txRow:         { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  txEmoji:       { fontSize: 20, width: 28 },
  txTitle:       { color: "#0F172A", fontWeight: "600", fontSize: 13 },
  txMeta:        { color: "#94A3B8", fontSize: 11, marginTop: 2 },
  txAmount:      { color: C.red, fontWeight: "700", fontSize: 14 },
  empty:         { alignItems: "center", paddingTop: 40, gap: 12 },
  emptyEmoji:    { fontSize: 48 },
  emptyText:     { color: "#64748B", fontSize: 15 },
});

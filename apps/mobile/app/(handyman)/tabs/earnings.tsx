import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../../../constants/api";
import { colors, fontSize, radius, spacing } from "../../../constants/theme";

type Period = "week" | "month" | "year";
interface Bucket { label: string; earnings: number; jobs: number }
interface Profile { totalEarnings: number; totalJobs: number; rating: number }
interface CashoutInfo {
  available: number;
  minCashout: number;
  instantFee: number;
  stripeStatus: string;
}
interface PayoutRecord { id: string; service: string; net: number; paidOutAt: string | null }

const BAR_MAX_HEIGHT = 80;

export default function EarningsScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("month");
  const [chart, setChart] = useState<Bucket[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cashout, setCashout] = useState<CashoutInfo | null>(null);
  const [history, setHistory] = useState<PayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [cashing, setCashing] = useState(false);
  const [view, setView] = useState<"earnings" | "jobs">("earnings");

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get(`/earnings?period=${period}`),
      api.get("/profile"),
      api.get("/handyman/cashout"),
    ]).then(([chartRes, profileRes, cashoutRes]) => {
      setChart(Array.isArray(chartRes.data) ? chartRes.data : []);
      setProfile(profileRes.data?.handymanProfile ?? null);
      setCashout(cashoutRes.data);
      setHistory(cashoutRes.data?.payoutHistory ?? []);
    }).finally(() => setLoading(false));
  }, [period]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleCashout = () => {
    if (!cashout) return;
    const youGet = (cashout.available - cashout.instantFee).toFixed(2);
    const fee = cashout.instantFee.toFixed(2);
    Alert.alert(
      "Cash Out Instantly",
      `You receive: $${youGet}\nInstant fee: $${fee}\n\nMoney arrives on your debit card within 30 minutes.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Cash Out",
          onPress: async () => {
            setCashing(true);
            try {
              await api.post("/handyman/cashout");
              Alert.alert("Done!", `$${youGet} is on its way to your debit card.`);
              loadAll();
            } catch (e: unknown) {
              const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Cashout failed";
              Alert.alert("Error", msg);
            } finally {
              setCashing(false);
            }
          },
        },
      ]
    );
  };

  const data = chart.map(b => ({ ...b, value: view === "earnings" ? b.earnings : b.jobs }));
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const total = chart.reduce((s, b) => s + b.earnings, 0);
  const totalJobs = chart.reduce((s, b) => s + b.jobs, 0);

  const noStripe = cashout && cashout.stripeStatus !== "active";
  const canCashout = cashout && cashout.available >= cashout.minCashout && cashout.stripeStatus === "active";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <Text style={styles.title}>Earnings</Text>
        <Text style={styles.subtitle}>Track your income and cash out</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Cashout widget ── */}
        {cashout && (
          <View>
            {noStripe ? (
              <Pressable
                style={styles.setupBanner}
                onPress={() => router.push("/(handyman)/payout-methods" as never)}
              >
                <View style={styles.setupLeft}>
                  <Ionicons name="warning" size={20} color="#F59E0B" />
                  <View>
                    <Text style={styles.setupTitle}>Set up payout methods</Text>
                    <Text style={styles.setupSub}>Add a debit card to cash out instantly</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#F59E0B" />
              </Pressable>
            ) : (
              <View style={styles.cashoutCard}>
                <View style={styles.cashoutTop}>
                  <View>
                    <Text style={styles.cashoutLabel}>Available to cash out</Text>
                    <Text style={styles.cashoutAmount}>${cashout.available.toFixed(2)}</Text>
                    {canCashout && (
                      <Text style={styles.cashoutFee}>
                        After ${cashout.instantFee.toFixed(2)} fee → ${(cashout.available - cashout.instantFee).toFixed(2)} to card
                      </Text>
                    )}
                    {!canCashout && cashout.available > 0 && (
                      <Text style={styles.cashoutFee}>Min ${cashout.minCashout} required</Text>
                    )}
                  </View>
                  <Pressable
                    style={[styles.cashoutBtn, (!canCashout || cashing) && styles.cashoutBtnDisabled]}
                    onPress={handleCashout}
                    disabled={!canCashout || cashing}
                  >
                    {cashing
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Ionicons name="flash" size={16} color="#fff" />}
                    <Text style={styles.cashoutBtnText}>Cash Out</Text>
                  </Pressable>
                </View>

                <View style={styles.weeklyBanner}>
                  <Ionicons name="calendar" size={13} color={colors.skyBlue} />
                  <Text style={styles.weeklyText}>Uncashed earnings auto-sent to your bank every Monday · Free</Text>
                </View>

                <Pressable
                  style={styles.manageBtn}
                  onPress={() => router.push("/(handyman)/payout-methods" as never)}
                >
                  <Ionicons name="card" size={14} color={colors.skyBlue} />
                  <Text style={styles.manageBtnText}>Manage payout methods</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.skyBlue} />
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* ── Stat cards ── */}
        {profile && (
          <View style={styles.statsRow}>
            {[
              { label: "All-Time", value: `$${profile.totalEarnings.toFixed(0)}`, color: colors.success },
              { label: "This Period", value: `$${total.toFixed(0)}`, color: colors.skyBlue },
              { label: "Jobs", value: String(profile.totalJobs), color: "#A78BFA" },
              { label: "Rating", value: `${profile.rating.toFixed(1)}★`, color: "#F59E0B" },
            ].map(s => (
              <View key={s.label} style={styles.statCard}>
                <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Chart ── */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>
              {view === "earnings" ? `$${total.toFixed(0)}` : `${totalJobs} jobs`}
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={styles.toggleRow}>
                {(["earnings", "jobs"] as const).map(v => (
                  <Pressable key={v} onPress={() => setView(v)} style={[styles.toggleBtn, view === v && styles.toggleBtnActive]}>
                    <Text style={[styles.toggleBtnText, view === v && styles.toggleBtnActiveText]}>{v}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.toggleRow}>
                {(["week", "month", "year"] as const).map(p => (
                  <Pressable key={p} onPress={() => setPeriod(p)} style={[styles.toggleBtn, period === p && styles.toggleBtnActive]}>
                    <Text style={[styles.toggleBtnText, period === p && styles.toggleBtnActiveText]}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {loading ? (
            <View style={{ height: 120, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={colors.skyBlue} />
            </View>
          ) : (
            <View style={styles.barChart}>
              {data.map((b, i) => {
                const h = Math.max((b.value / maxVal) * BAR_MAX_HEIGHT, b.value > 0 ? 4 : 2);
                return (
                  <View key={i} style={styles.barGroup}>
                    <Text style={styles.barValue}>
                      {b.value > 0 ? (view === "earnings" ? `$${b.value.toFixed(0)}` : String(b.value)) : ""}
                    </Text>
                    <View style={[styles.bar, { height: h, opacity: b.value > 0 ? 1 : 0.2 }]} />
                    <Text style={styles.barLabel}>{b.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Payout history ── */}
        {history.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Payout History</Text>
            {history.map(h => (
              <View key={h.id} style={styles.paymentRow}>
                <View style={styles.payIcon}>
                  <Ionicons name="arrow-down-circle" size={18} color={colors.skyBlue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payLabel}>{h.service}</Text>
                  <Text style={styles.payJobs}>
                    {h.paidOutAt ? new Date(h.paidOutAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                  </Text>
                </View>
                <Text style={[styles.payAmount, { color: colors.skyBlue }]}>+${h.net.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Recent jobs ── */}
        <View>
          <Text style={styles.sectionTitle}>Recent Payments</Text>
          {chart.filter(b => b.jobs > 0).length === 0 ? (
            <Text style={styles.empty}>No completed jobs yet.</Text>
          ) : chart.filter(b => b.jobs > 0).map((b, i) => (
            <View key={i} style={styles.paymentRow}>
              <View style={styles.payIcon}>
                <Ionicons name="cash" size={18} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.payLabel}>{b.label}</Text>
                <Text style={styles.payJobs}>{b.jobs} job{b.jobs !== 1 ? "s" : ""} completed</Text>
              </View>
              <Text style={styles.payAmount}>+${b.earnings.toFixed(0)}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  title: { fontSize: fontSize["2xl"], fontWeight: "800", color: colors.white },
  subtitle: { color: colors.inkSubtle, fontSize: fontSize.sm, marginTop: 2 },
  scroll: { padding: spacing.xl, gap: spacing.xl, paddingBottom: 100 },

  // cashout
  cashoutCard: { backgroundColor: "#2E1065", borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: "#7C3AED40", gap: spacing.sm },
  cashoutTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  cashoutLabel: { color: "#C4B5FD", fontSize: fontSize.xs, fontWeight: "600", marginBottom: 2 },
  cashoutAmount: { color: colors.white, fontSize: fontSize["3xl"], fontWeight: "900" },
  cashoutFee: { color: "#A78BFA", fontSize: fontSize.xs, marginTop: 2 },
  cashoutBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#7C3AED", paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.lg },
  cashoutBtnDisabled: { opacity: 0.4 },
  cashoutBtnText: { color: colors.white, fontWeight: "700", fontSize: fontSize.sm },
  weeklyBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(56,189,248,0.08)", borderRadius: radius.md, padding: spacing.sm },
  weeklyText: { color: colors.skyBlue, fontSize: fontSize.xs, flex: 1 },
  manageBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  manageBtnText: { color: colors.skyBlue, fontSize: fontSize.xs, fontWeight: "600", flex: 1 },

  setupBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(245,158,11,0.1)", borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: "rgba(245,158,11,0.3)" },
  setupLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  setupTitle: { color: colors.white, fontWeight: "700", fontSize: fontSize.sm },
  setupSub: { color: colors.inkSubtle, fontSize: fontSize.xs, marginTop: 2 },

  statsRow: { flexDirection: "row", gap: spacing.sm },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, alignItems: "center", gap: 4, borderWidth: 1, borderColor: colors.cardBorder },
  statValue: { fontSize: fontSize.lg, fontWeight: "800" },
  statLabel: { fontSize: fontSize.xs, color: colors.inkSubtle },

  chartCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.cardBorder, gap: spacing.md },
  chartHeader: { gap: spacing.sm },
  chartTitle: { color: colors.white, fontWeight: "800", fontSize: fontSize.xl },
  toggleRow: { flexDirection: "row", gap: 4, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: radius.md, padding: 3 },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm },
  toggleBtnActive: { backgroundColor: colors.skyBlue },
  toggleBtnText: { color: colors.inkSubtle, fontSize: fontSize.xs, fontWeight: "600", textTransform: "capitalize" },
  toggleBtnActiveText: { color: colors.ink },
  barChart: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: BAR_MAX_HEIGHT + 40 },
  barGroup: { flex: 1, alignItems: "center", gap: 4, justifyContent: "flex-end" },
  barValue: { color: colors.skyBlue, fontSize: 8, fontWeight: "700", textAlign: "center" },
  bar: { width: "100%", backgroundColor: colors.skyBlue, borderRadius: 4, minHeight: 2 },
  barLabel: { color: colors.inkSubtle, fontSize: 9, fontWeight: "600", textAlign: "center" },

  sectionTitle: { color: colors.white, fontWeight: "700", fontSize: fontSize.lg, marginBottom: spacing.sm },
  empty: { color: colors.inkSubtle, textAlign: "center", paddingVertical: spacing.xl },
  paymentRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.cardBorder },
  payIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.success + "15", borderWidth: 1, borderColor: colors.success + "30", alignItems: "center", justifyContent: "center" },
  payLabel: { color: colors.white, fontWeight: "600", fontSize: fontSize.sm },
  payJobs: { color: colors.inkSubtle, fontSize: fontSize.xs, marginTop: 2 },
  payAmount: { color: colors.success, fontWeight: "800", fontSize: fontSize.base },
});

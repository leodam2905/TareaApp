import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { api } from "../../../constants/api";
import { colors, fontSize, radius, spacing } from "../../../constants/theme";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#F59E0B", ACCEPTED: "#38BDF8", IN_PROGRESS: "#38BDF8",
  COMPLETED: "#10B981", CANCELLED: "#EF4444",
};

interface Booking {
  id: string;
  status: string;
  scheduledAt: string;
  totalPrice: number;
  service: { title: string; category: string };
  customer: { name: string };
}

interface Checklist {
  hasIca: boolean;
  hasBackgroundCheck: boolean;
  hasStripe: boolean;
  hasService: boolean;
  hasPortfolio: boolean;
}

export default function HandymanDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState<Checklist | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [userStr, res, icaRes, bgRes, stripeRes, servicesRes, portfolioRes] = await Promise.all([
          SecureStore.getItemAsync("tarea_user"),
          api.get("/bookings"),
          api.get("/handyman/ica").catch(() => ({ data: { signed: false } })),
          api.get("/handyman/background-check").catch(() => ({ data: { status: "NONE" } })),
          api.get("/stripe/connect").catch(() => ({ data: {} })),
          api.get("/services?mine=1").catch(() => ({ data: { services: [] } })),
          api.get("/portfolio").catch(() => ({ data: [] })),
        ]);
        if (userStr) setUser(JSON.parse(userStr));
        setBookings(res.data.slice(0, 6));

        const hasIca = icaRes.data?.signed === true;
        const bgStatus = bgRes.data?.status ?? "NONE";
        const hasBackgroundCheck = bgStatus === "PASSED";
        const bgInitiated = ["PAID", "IN_PROGRESS", "DEFERRED"].includes(bgStatus);

        // Gate: redirect to ICA if not signed
        if (!hasIca) {
          router.replace("/(handyman)/ica" as never);
          return;
        }
        // Gate: redirect to background check if never started
        if (!hasBackgroundCheck && !bgInitiated) {
          router.replace("/(handyman)/background-check" as never);
          return;
        }

        setChecklist({
          hasIca,
          hasBackgroundCheck,
          hasStripe: stripeRes.data?.status === "active",
          hasService: (servicesRes.data?.services?.length ?? servicesRes.data?.length ?? 0) > 0,
          hasPortfolio: (portfolioRes.data?.length ?? 0) > 0,
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const pending = bookings.filter((b) => b.status === "PENDING").length;
  const active = bookings.filter((b) => ["ACCEPTED", "IN_PROGRESS"].includes(b.status)).length;
  const completed = bookings.filter((b) => b.status === "COMPLETED").length;
  const earned = bookings.filter((b) => b.status === "COMPLETED").reduce((s, b) => s + b.totalPrice * 0.90, 0);

  if (loading) return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.skyBlue} size="large" />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={["#0F2560", "#1E3A8A"]} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Hey, {user?.name?.split(" ")[0] || "Pro"} 🔧</Text>
            <Text style={styles.headerSub}>Here's your job overview</Text>
          </View>
          <Pressable style={styles.bell} onPress={() => router.push("/notifications" as never)}>
            <Ionicons name="notifications" size={22} color={colors.white} />
          </Pressable>
        </View>

        <View style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>Total Earnings</Text>
          <Text style={styles.earningsValue}>${earned.toFixed(2)}</Text>
        </View>

        <View style={styles.statsRow}>
          {[
            { label: "Pending", value: pending, color: "#F59E0B" },
            { label: "Active", value: active, color: colors.skyBlue },
            { label: "Completed", value: completed, color: "#10B981" },
          ].map(({ label, value, color }) => (
            <View key={label} style={styles.statCard}>
              <Text style={[styles.statValue, { color }]}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>
        {/* Quick actions */}
        <View style={styles.quickActions}>
          {[
            { label: "Jobs", icon: "briefcase", color: colors.skyBlue, onPress: () => router.push("/(handyman)/tabs/my-jobs") },
            { label: "Earnings", icon: "cash", color: "#10B981", onPress: () => router.push("/(handyman)/tabs/earnings") },
            { label: "Profile", icon: "person", color: "#A78BFA", onPress: () => router.push("/(handyman)/tabs/profile") },
          ].map(({ label, icon, color, onPress }) => (
            <Pressable key={label} style={({ pressed }) => [styles.quickBtn, pressed && { opacity: 0.8 }]} onPress={onPress}>
              <View style={[styles.quickIcon, { backgroundColor: `${color}20`, borderColor: `${color}30` }]}>
                <Ionicons name={icon as never} size={24} color={color} />
              </View>
              <Text style={styles.quickLabel}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Onboarding checklist */}
        {checklist && !(checklist.hasIca && checklist.hasBackgroundCheck && checklist.hasStripe && checklist.hasService && checklist.hasPortfolio) && (
          <View style={styles.checklistCard}>
            <Text style={styles.checklistTitle}>Get started</Text>
            <Text style={styles.checklistSub}>Complete these steps to attract more customers</Text>
            {[
              { label: "Sign contractor agreement", done: checklist.hasIca, onPress: () => router.push("/(handyman)/ica" as never) },
              { label: "Complete background check", done: checklist.hasBackgroundCheck, onPress: () => router.push("/(handyman)/background-check" as never) },
              { label: "Connect Stripe to get paid", done: checklist.hasStripe, onPress: () => router.push("/(handyman)/tabs/profile" as never) },
              { label: "Add your first service", done: checklist.hasService, onPress: () => router.push("/(handyman)/tabs/services" as never) },
              { label: "Upload a portfolio photo", done: checklist.hasPortfolio, onPress: () => router.push("/(handyman)/tabs/profile" as never) },
            ].map(({ label, done, onPress }) => (
              <Pressable key={label} style={styles.checklistRow} onPress={done ? undefined : onPress}>
                <View style={[styles.checkCircle, done && styles.checkCircleDone]}>
                  {done && <Ionicons name="checkmark" size={12} color={colors.white} />}
                </View>
                <Text style={[styles.checkLabel, done && styles.checkLabelDone]}>{label}</Text>
                {!done && <Ionicons name="chevron-forward" size={14} color={colors.inkSubtle} />}
              </Pressable>
            ))}
          </View>
        )}

        {/* Job requests */}
        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Job Requests</Text>
            <Pressable onPress={() => router.push("/(handyman)/tabs/my-jobs")}>
              <Text style={styles.seeAll}>Manage all</Text>
            </Pressable>
          </View>
          {bookings.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No jobs yet. Add services to attract customers.</Text>
            </View>
          ) : (
            <View style={styles.jobsList}>
              {bookings.map((b) => (
                <Pressable key={b.id} style={styles.jobCard}>
                  <View style={styles.jobLeft}>
                    <Text style={styles.jobTitle} numberOfLines={1}>{b.service.title}</Text>
                    <Text style={styles.jobMeta}>{b.customer.name}</Text>
                    <Text style={styles.jobDate}>
                      {new Date(b.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                  <View style={styles.jobRight}>
                    <Text style={styles.jobPrice}>${b.totalPrice.toFixed(0)}</Text>
                    <View style={[styles.statusPill, { backgroundColor: `${STATUS_COLORS[b.status]}20`, borderColor: `${STATUS_COLORS[b.status]}40` }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLORS[b.status] }]}>{b.status.replace("_", " ")}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* FAB — add service */}
      <Pressable style={styles.fab} onPress={() => router.push("/(handyman)/tabs/services")}>
        <LinearGradient colors={["#1E3A8A", "#38BDF8"]} style={styles.fabGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name="add" size={30} color={colors.white} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: spacing.xl },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.lg },
  greeting: { fontSize: fontSize["2xl"], fontWeight: "800", color: colors.white },
  headerSub: { fontSize: fontSize.sm, color: "rgba(255,255,255,0.55)", marginTop: 4 },
  bell: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  earningsCard: { backgroundColor: "rgba(56,189,248,0.15)", borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: "rgba(56,189,248,0.3)" },
  earningsLabel: { color: colors.skyBlue, fontSize: fontSize.sm, fontWeight: "600", marginBottom: 4 },
  earningsValue: { color: colors.white, fontSize: 36, fontWeight: "900" },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  statCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: radius.md, padding: spacing.md, alignItems: "center", gap: 4 },
  statValue: { fontSize: fontSize.xl, fontWeight: "800" },
  statLabel: { fontSize: fontSize.xs, color: "rgba(255,255,255,0.5)" },
  scroll: { padding: spacing.xl, gap: spacing.xl, paddingBottom: 120 },
  quickActions: { flexDirection: "row", justifyContent: "space-around" },
  quickBtn: { alignItems: "center", gap: spacing.sm },
  quickIcon: { width: 60, height: 60, borderRadius: radius.lg, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  quickLabel: { fontSize: fontSize.sm, color: colors.white, fontWeight: "600" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.white },
  seeAll: { fontSize: fontSize.sm, color: colors.skyBlue, fontWeight: "600" },
  emptyCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.xl, alignItems: "center", borderWidth: 1, borderColor: colors.cardBorder },
  emptyText: { color: colors.inkSubtle, textAlign: "center" },
  jobsList: { gap: spacing.sm },
  jobCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderColor: colors.cardBorder },
  jobLeft: { flex: 1, gap: 3 },
  jobTitle: { color: colors.white, fontWeight: "700", fontSize: fontSize.sm },
  jobMeta: { color: colors.inkSubtle, fontSize: fontSize.xs },
  jobDate: { color: colors.skyBlue, fontSize: fontSize.xs },
  jobRight: { alignItems: "flex-end", gap: 6 },
  jobPrice: { color: colors.white, fontWeight: "800", fontSize: fontSize.lg },
  statusPill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: "700" },
  fab: { position: "absolute", bottom: 32, right: 24, width: 60, height: 60, borderRadius: 30, overflow: "hidden", shadowColor: colors.darkBlue, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  fabGradient: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
  checklistCard: { backgroundColor: "rgba(56,189,248,0.08)", borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: "rgba(56,189,248,0.2)" },
  checklistTitle: { color: colors.white, fontWeight: "700", fontSize: fontSize.base },
  checklistSub: { color: colors.inkSubtle, fontSize: fontSize.xs },
  checklistRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 6 },
  checkCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.inkSubtle, alignItems: "center", justifyContent: "center" },
  checkCircleDone: { backgroundColor: "#10B981", borderColor: "#10B981" },
  checkLabel: { flex: 1, color: colors.white, fontSize: fontSize.sm },
  checkLabelDone: { color: colors.inkSubtle, textDecorationLine: "line-through" },
});

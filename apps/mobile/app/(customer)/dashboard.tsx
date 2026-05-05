import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "../../constants/api";
import { colors, fontSize, radius, spacing } from "../../constants/theme";

const CATEGORY_ICONS: Record<string, string> = {
  PLUMBING: "🔧", ELECTRICAL: "⚡", CARPENTRY: "🪚",
  PAINTING: "🎨", CLEANING: "🧹", HVAC: "❄️",
  ROOFING: "🏠", LANDSCAPING: "🌿", MOVING: "📦",
  APPLIANCE_REPAIR: "🔌", GENERAL: "🛠️",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#F59E0B", ACCEPTED: "#38BDF8", IN_PROGRESS: "#38BDF8",
  COMPLETED: "#10B981", CANCELLED: "#EF4444", DISPUTED: "#EF4444",
};

interface Booking {
  id: string;
  status: string;
  scheduledAt: string;
  totalPrice: number;
  service: { title: string; category: string };
  handyman: { name: string };
}

export default function CustomerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [userStr, bookingsRes] = await Promise.all([
        SecureStore.getItemAsync("tarea_user"),
        api.get("/bookings"),
      ]);
      if (userStr) setUser(JSON.parse(userStr));
      setBookings(bookingsRes.data.slice(0, 5));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const stats = [
    { label: "Total", value: bookings.length, icon: "calendar", color: colors.skyBlue },
    { label: "Active", value: bookings.filter((b) => ["PENDING", "ACCEPTED", "IN_PROGRESS"].includes(b.status)).length, icon: "time", color: "#F59E0B" },
    { label: "Done", value: bookings.filter((b) => b.status === "COMPLETED").length, icon: "checkmark-circle", color: "#10B981" },
  ];

  if (loading) return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.skyBlue} size="large" />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <LinearGradient colors={["#0F2560", "#1E3A8A"]} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Good day, {user?.name?.split(" ")[0] || "there"} 👋</Text>
            <Text style={styles.headerSub}>What do you need fixed today?</Text>
          </View>
          <Pressable onPress={() => router.push("/(customer)/notifications")} style={styles.bell}>
            <Ionicons name="notifications" size={22} color={colors.white} />
          </Pressable>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {stats.map(({ label, value, icon, color }) => (
            <View key={label} style={styles.statCard}>
              <Ionicons name={icon as never} size={18} color={color} />
              <Text style={[styles.statValue, { color }]}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.skyBlue} />}
      >
        {/* Quick actions */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.quickActions}>
          {[
            { label: "Browse", icon: "search", color: colors.skyBlue, onPress: () => router.push("/(customer)/browse") },
            { label: "Bookings", icon: "calendar", color: "#A78BFA", onPress: () => router.push("/(customer)/bookings") },
            { label: "Profile", icon: "person", color: "#10B981", onPress: () => router.push("/(customer)/profile") },
          ].map(({ label, icon, color, onPress }) => (
            <Pressable key={label} style={({ pressed }) => [styles.quickBtn, pressed && { opacity: 0.8 }]} onPress={onPress}>
              <View style={[styles.quickIcon, { backgroundColor: `${color}20`, borderColor: `${color}30` }]}>
                <Ionicons name={icon as never} size={24} color={color} />
              </View>
              <Text style={styles.quickLabel}>{label}</Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* Recent bookings */}
        <Animated.View entering={FadeInDown.delay(200)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Bookings</Text>
            <Pressable onPress={() => router.push("/(customer)/bookings")}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>

          {bookings.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No bookings yet.</Text>
              <Pressable style={styles.emptyBtn} onPress={() => router.push("/(customer)/browse")}>
                <Text style={styles.emptyBtnText}>Browse Services</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.bookingsList}>
              {bookings.map((b) => (
                <View key={b.id} style={styles.bookingCard}>
                  <Text style={styles.bookingIcon}>{CATEGORY_ICONS[b.service.category] || "🛠️"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookingTitle} numberOfLines={1}>{b.service.title}</Text>
                    <Text style={styles.bookingMeta}>{b.handyman.name}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.bookingPrice}>${b.totalPrice.toFixed(0)}</Text>
                    <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[b.status] || colors.inkSubtle }]}>
                      <Text style={styles.statusText}>{b.status.replace("_", " ")}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* FAB */}
      <Pressable style={styles.fab} onPress={() => router.push("/(customer)/browse")}>
        <LinearGradient colors={["#0284C7", "#38BDF8"]} style={styles.fabGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name="search" size={26} color={colors.ink} />
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
  statsRow: { flexDirection: "row", gap: spacing.sm },
  statCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: radius.md, padding: spacing.md, alignItems: "center", gap: 4 },
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
  emptyText: { color: colors.inkSubtle, marginBottom: spacing.md },
  emptyBtn: { backgroundColor: colors.skyBlue, paddingHorizontal: spacing.xl, paddingVertical: 12, borderRadius: radius.md },
  emptyBtnText: { color: colors.ink, fontWeight: "700" },
  bookingsList: { gap: spacing.sm },
  bookingCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.cardBorder },
  bookingIcon: { fontSize: 28 },
  bookingTitle: { color: colors.white, fontWeight: "600", fontSize: fontSize.sm },
  bookingMeta: { color: colors.inkSubtle, fontSize: fontSize.xs, marginTop: 2 },
  bookingPrice: { color: colors.skyBlue, fontWeight: "800", fontSize: fontSize.base },
  statusDot: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  statusText: { color: colors.white, fontSize: 10, fontWeight: "700" },
  fab: { position: "absolute", bottom: 32, right: 24, width: 60, height: 60, borderRadius: 30, overflow: "hidden", shadowColor: colors.skyBlue, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  fabGradient: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
});

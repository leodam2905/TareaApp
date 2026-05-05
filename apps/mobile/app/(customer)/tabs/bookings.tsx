import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "../../../constants/api";
import { colors, fontSize, radius, spacing } from "../../../constants/theme";

const CATEGORY_ICONS: Record<string, string> = {
  PLUMBING: "🔧", ELECTRICAL: "⚡", CARPENTRY: "🪚", PAINTING: "🎨",
  CLEANING: "🧹", HVAC: "❄️", ROOFING: "🏠", LANDSCAPING: "🌿",
  MOVING: "📦", APPLIANCE_REPAIR: "🔌", GENERAL: "🛠️",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#F59E0B", ACCEPTED: "#38BDF8", IN_PROGRESS: "#38BDF8",
  COMPLETED: "#10B981", CANCELLED: "#EF4444", DISPUTED: "#EF4444",
};

interface Booking {
  id: string; status: string; scheduledAt: string; totalPrice: number;
  isOnMyWay: boolean;
  service: { title: string; category: string };
  handyman: { name: string; phone: string | null };
  review: { id: string } | null;
}

export default function CustomerBookingsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/bookings");
      setBookings(res.data);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.skyBlue} size="large" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.skyBlue} />}
      >
        {bookings.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No bookings yet.</Text>
            <Pressable style={styles.btn} onPress={() => router.push("/(customer)/tabs/browse")}>
              <Text style={styles.btnText}>Browse Services</Text>
            </Pressable>
          </View>
        ) : bookings.map((b, i) => (
          <Animated.View key={b.id} entering={FadeInDown.delay(i * 50)}>
            <Pressable style={styles.card} onPress={() => router.push(`/booking/${b.id}` as never)}>
              <Text style={styles.icon}>{CATEGORY_ICONS[b.service.category] || "🛠️"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceTitle} numberOfLines={1}>{b.service.title}</Text>
                <Text style={styles.meta}>{b.handyman.name}</Text>
                {b.isOnMyWay && ["ACCEPTED", "IN_PROGRESS"].includes(b.status) && (
                  <Text style={styles.onWay}>🚗 Handyman is on the way!</Text>
                )}
                {(b as any).status === "ACCEPTED" && !(b as any).isPaid && (
                  <Text style={styles.payAlert}>💳 Payment required</Text>
                )}
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text style={styles.price}>${(b.totalPrice * 1.10).toFixed(0)}</Text>
                <View style={[styles.badge, { backgroundColor: STATUS_COLORS[b.status] + "30" }]}>
                  <Text style={[styles.badgeText, { color: STATUS_COLORS[b.status] }]}>{b.status.replace("_", " ")}</Text>
                </View>
                {b.status === "COMPLETED" && !b.review && (
                  <Text style={styles.reviewLink}>⭐ Review</Text>
                )}
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  header: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  title: { fontSize: fontSize["2xl"], fontWeight: "800", color: colors.white },
  scroll: { padding: spacing.xl, gap: spacing.sm, paddingBottom: 100 },
  empty: { alignItems: "center", paddingTop: 60, gap: spacing.md },
  emptyText: { color: colors.inkSubtle, fontSize: fontSize.base },
  btn: { backgroundColor: colors.skyBlue, paddingHorizontal: spacing.xl, paddingVertical: 12, borderRadius: radius.lg },
  btnText: { color: colors.ink, fontWeight: "700", fontSize: fontSize.base },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.cardBorder },
  icon: { fontSize: 28 },
  serviceTitle: { color: colors.white, fontWeight: "700", fontSize: fontSize.sm },
  meta: { color: colors.inkSubtle, fontSize: fontSize.xs, marginTop: 2 },
  onWay: { color: colors.success, fontSize: fontSize.xs, marginTop: 2, fontWeight: "600" },
  price: { color: colors.skyBlue, fontWeight: "800", fontSize: fontSize.base },
  badge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  reviewLink: { color: "#F59E0B", fontSize: 10, fontWeight: "700" },
  payAlert: { color: "#F59E0B", fontSize: 10, fontWeight: "700", marginTop: 2 },
});

import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Location from "expo-location";
import { api } from "../../../constants/api";
import { colors, fontSize, radius, spacing } from "../../../constants/theme";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#F59E0B", ACCEPTED: "#38BDF8", IN_PROGRESS: "#38BDF8",
  COMPLETED: "#10B981", CANCELLED: "#EF4444", DISPUTED: "#EF4444",
};
const CATEGORY_ICONS: Record<string, string> = {
  PLUMBING: "🔧", ELECTRICAL: "⚡", CARPENTRY: "🪚", PAINTING: "🎨",
  CLEANING: "🧹", HVAC: "❄️", ROOFING: "🏠", LANDSCAPING: "🌿",
  MOVING: "📦", APPLIANCE_REPAIR: "🔌", GENERAL: "🛠️",
};

interface Booking {
  id: string; status: string; scheduledAt: string; totalPrice: number;
  address: string; city: string; notes: string | null; isOnMyWay: boolean;
  service: { title: string; category: string };
  customer: { name: string; phone: string | null };
}

const TABS = ["pending", "active", "done"] as const;
const GROUPS: Record<string, string[]> = {
  pending: ["PENDING"],
  active: ["ACCEPTED", "IN_PROGRESS"],
  done: ["COMPLETED", "CANCELLED", "DISPUTED"],
};

export default function HandymanMyJobsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<typeof TABS[number]>("pending");
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/bookings");
      setBookings(Array.isArray(res.data) ? res.data : []);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, status: "ACCEPTED" | "CANCELLED") => {
    setActing(id);
    try {
      await api.patch(`/bookings/${id}`, { status });
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    } catch { Alert.alert("Error", "Action failed"); }
    setActing(null);
  };

  const toggleOnMyWay = async (b: Booking) => {
    if (b.isOnMyWay) {
      await api.patch(`/bookings/${b.id}/location`, { isOnMyWay: false });
      setBookings(prev => prev.map(x => x.id === b.id ? { ...x, isOnMyWay: false } : x));
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission denied"); return; }
    const loc = await Location.getCurrentPositionAsync({});
    await api.patch(`/bookings/${b.id}/location`, { lat: loc.coords.latitude, lng: loc.coords.longitude, isOnMyWay: true });
    setBookings(prev => prev.map(x => x.id === b.id ? { ...x, isOnMyWay: true } : x));
    Alert.alert("On My Way!", "The customer has been notified.");
  };

  const visible = bookings.filter(b => GROUPS[tab].includes(b.status));
  const pendingCount = bookings.filter(b => b.status === "PENDING").length;

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.skyBlue} size="large" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <Text style={styles.title}>My Jobs</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map(t => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabBtnActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
            {t === "pending" && pendingCount > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{pendingCount}</Text></View>
            )}
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.skyBlue} />}
      >
        {visible.length === 0 ? (
          <Text style={styles.empty}>No {tab} jobs yet.</Text>
        ) : visible.map((b, i) => (
          <Animated.View key={b.id} entering={FadeInDown.delay(i * 50)}>
            <View style={[styles.card, b.status === "PENDING" && styles.pendingCard]}>
              <View style={styles.cardRow}>
                <Text style={styles.icon}>{CATEGORY_ICONS[b.service.category] || "🛠️"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceTitle}>{b.service.title}</Text>
                  <Text style={styles.customerName}>{b.customer.name}</Text>
                  {b.customer.phone && <Text style={styles.phone}>📞 {b.customer.phone}</Text>}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[b.status] + "30" }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[b.status] }]}>{b.status.replace("_", " ")}</Text>
                </View>
              </View>

              <View style={styles.details}>
                <Text style={styles.detailText}>📅 {new Date(b.scheduledAt).toLocaleDateString()}</Text>
                <Text style={styles.detailText}>📍 {b.address}, {b.city}</Text>
                <Text style={[styles.detailText, { color: colors.success }]}>${(b.totalPrice * 0.90).toFixed(0)} <Text style={{ color: colors.inkSubtle, fontSize: 10 }}>(after 10% fee)</Text></Text>
              </View>

              <View style={styles.actions}>
                <Pressable style={styles.chatBtn} onPress={() => router.push(`/chat/${b.id}`)}>
                  <Ionicons name="chatbubble" size={14} color={colors.inkSubtle} />
                  <Text style={styles.chatBtnText}>Chat</Text>
                </Pressable>

                {b.status === "PENDING" && (
                  <>
                    <Pressable style={styles.declineBtn} onPress={() => act(b.id, "CANCELLED")} disabled={acting === b.id}>
                      <Text style={styles.declineBtnText}>Decline</Text>
                    </Pressable>
                    <Pressable style={styles.acceptBtn} onPress={() => act(b.id, "ACCEPTED")} disabled={acting === b.id}>
                      <Text style={styles.acceptBtnText}>Accept</Text>
                    </Pressable>
                  </>
                )}

                {b.status === "ACCEPTED" && (
                  <Pressable
                    style={[styles.onWayBtn, b.isOnMyWay && styles.onWayBtnActive]}
                    onPress={() => toggleOnMyWay(b)}
                  >
                    <Ionicons name="navigate" size={14} color={b.isOnMyWay ? colors.success : colors.ink} />
                    <Text style={[styles.onWayBtnText, b.isOnMyWay && { color: colors.success }]}>
                      {b.isOnMyWay ? "On My Way ✓" : "I'm On My Way"}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
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
  tabs: { flexDirection: "row", marginHorizontal: spacing.xl, marginBottom: spacing.md, backgroundColor: colors.card, borderRadius: radius.xl, padding: 4, borderWidth: 1, borderColor: colors.cardBorder },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: radius.lg, gap: 4 },
  tabBtnActive: { backgroundColor: colors.skyBlue },
  tabText: { color: colors.inkSubtle, fontSize: fontSize.sm, fontWeight: "600", textTransform: "capitalize" },
  tabTextActive: { color: colors.ink },
  badge: { backgroundColor: colors.danger, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: "800" },
  scroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: 100 },
  empty: { color: colors.inkSubtle, textAlign: "center", paddingTop: 60, fontSize: fontSize.base },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.cardBorder, gap: spacing.md },
  pendingCard: { borderColor: "#F59E0B40", backgroundColor: "#F59E0B08" },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  icon: { fontSize: 26 },
  serviceTitle: { color: colors.white, fontWeight: "700", fontSize: fontSize.base },
  customerName: { color: colors.inkSubtle, fontSize: fontSize.sm, marginTop: 2 },
  phone: { color: colors.inkSubtle, fontSize: fontSize.xs, marginTop: 2 },
  statusBadge: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: "700" },
  details: { gap: 4 },
  detailText: { color: colors.inkSubtle, fontSize: fontSize.xs },
  actions: { flexDirection: "row", gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: spacing.md },
  chatBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.cardBorder },
  chatBtnText: { color: colors.inkSubtle, fontSize: fontSize.xs, fontWeight: "600" },
  declineBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger + "40" },
  declineBtnText: { color: colors.danger, fontWeight: "700", fontSize: fontSize.sm },
  acceptBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.success },
  acceptBtnText: { color: colors.white, fontWeight: "800", fontSize: fontSize.sm },
  onWayBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.skyBlue },
  onWayBtnActive: { backgroundColor: colors.success + "20", borderWidth: 1, borderColor: colors.success + "40" },
  onWayBtnText: { color: colors.ink, fontWeight: "800", fontSize: fontSize.sm },
});

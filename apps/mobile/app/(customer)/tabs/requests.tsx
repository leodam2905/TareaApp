import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { api } from "../../../constants/api";
import { colors, fontSize, radius, spacing } from "../../../constants/theme";

interface Application {
  id: string; status: string; message: string | null; proposedPrice: number | null;
  user: { name: string }; handyman: { rating: number; totalJobs: number };
}
interface JobRequest {
  id: string; title: string; category: string; city: string;
  budgetMin: number; budgetMax: number; status: string; createdAt: string;
  applications: Application[];
}

const CATEGORY_ICONS: Record<string, string> = {
  PLUMBING: "🔧", ELECTRICAL: "⚡", CARPENTRY: "🪚", PAINTING: "🎨",
  CLEANING: "🧹", HVAC: "❄️", ROOFING: "🏠", LANDSCAPING: "🌿",
  MOVING: "📦", APPLIANCE_REPAIR: "🔌", GENERAL: "🛠️",
};
const STATUS_COLORS: Record<string, string> = { OPEN: colors.skyBlue, ASSIGNED: colors.success, CLOSED: colors.inkSubtle };

export default function RequestsScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/job-requests");
      setRequests(Array.isArray(res.data) ? res.data : []);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (jobId: string, appId: string, action: "accept" | "reject") => {
    setActing(appId);
    try {
      await api.patch(`/job-requests/${jobId}/applications/${appId}`, { action });
      setRequests(prev => prev.map(r => {
        if (r.id !== jobId) return r;
        return {
          ...r,
          status: action === "accept" ? "ASSIGNED" : r.status,
          applications: r.applications.map(a =>
            a.id === appId ? { ...a, status: action === "accept" ? "ACCEPTED" : "REJECTED" }
              : action === "accept" ? { ...a, status: "REJECTED" } : a
          ),
        };
      }));
    } catch { Alert.alert("Error", "Action failed"); }
    setActing(null);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.skyBlue} size="large" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <Text style={styles.title}>My Requests</Text>
        <Pressable style={styles.postBtn} onPress={() => router.push("/post-job")}>
          <Ionicons name="add" size={18} color={colors.ink} />
          <Text style={styles.postBtnText}>Post Job</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.skyBlue} />}
      >
        {requests.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No job requests yet.</Text>
            <Pressable style={styles.btn} onPress={() => router.push("/post-job")}>
              <Text style={styles.btnText}>Post Your First Job</Text>
            </Pressable>
          </View>
        ) : requests.map((r, i) => (
          <Animated.View key={r.id} entering={FadeInDown.delay(i * 60)}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.icon}>{CATEGORY_ICONS[r.category] || "🛠️"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{r.title}</Text>
                  <Text style={styles.cardMeta}>{r.city} · ${r.budgetMin}–${r.budgetMax}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: STATUS_COLORS[r.status] + "30" }]}>
                  <Text style={[styles.badgeText, { color: STATUS_COLORS[r.status] }]}>{r.status}</Text>
                </View>
              </View>
              {r.applications.length > 0 && (
                <View style={styles.apps}>
                  <Text style={styles.appsLabel}>{r.applications.length} applicant{r.applications.length !== 1 ? "s" : ""}</Text>
                  {r.applications.map(a => (
                    <View key={a.id} style={[styles.app, a.status === "ACCEPTED" && { borderColor: colors.success + "40" }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.appName}>{a.user.name}</Text>
                        <Text style={styles.appMeta}>⭐ {a.handyman.rating.toFixed(1)} · {a.handyman.totalJobs} jobs</Text>
                        {a.message && <Text style={styles.appMsg} numberOfLines={1}>"{a.message}"</Text>}
                        {a.proposedPrice && <Text style={styles.appPrice}>${a.proposedPrice}</Text>}
                      </View>
                      {a.status === "PENDING" && r.status === "OPEN" && (
                        <View style={{ gap: 6 }}>
                          <Pressable onPress={() => act(r.id, a.id, "accept")} disabled={acting === a.id}
                            style={styles.acceptBtn}>
                            <Text style={styles.acceptBtnText}>Accept</Text>
                          </Pressable>
                          <Pressable onPress={() => act(r.id, a.id, "reject")} disabled={acting === a.id}
                            style={styles.rejectBtn}>
                            <Ionicons name="close" size={14} color={colors.danger} />
                          </Pressable>
                        </View>
                      )}
                      {a.status === "ACCEPTED" && <Ionicons name="checkmark-circle" size={22} color={colors.success} />}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  header: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: fontSize["2xl"], fontWeight: "800", color: colors.white },
  postBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.skyBlue, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.lg },
  postBtnText: { color: colors.ink, fontWeight: "700", fontSize: fontSize.sm },
  scroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: 100 },
  empty: { alignItems: "center", paddingTop: 60, gap: spacing.md },
  emptyText: { color: colors.inkSubtle },
  btn: { backgroundColor: colors.skyBlue, paddingHorizontal: spacing.xl, paddingVertical: 12, borderRadius: radius.lg },
  btnText: { color: colors.ink, fontWeight: "700" },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  icon: { fontSize: 24 },
  cardTitle: { color: colors.white, fontWeight: "700", fontSize: fontSize.base },
  cardMeta: { color: colors.inkSubtle, fontSize: fontSize.xs, marginTop: 2 },
  badge: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  apps: { borderTopWidth: 1, borderTopColor: colors.cardBorder, padding: spacing.md, gap: spacing.sm },
  appsLabel: { color: colors.inkSubtle, fontSize: fontSize.xs, fontWeight: "600" },
  app: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.cardBorder },
  appName: { color: colors.white, fontWeight: "600", fontSize: fontSize.sm },
  appMeta: { color: colors.inkSubtle, fontSize: fontSize.xs, marginTop: 2 },
  appMsg: { color: colors.inkSubtle, fontSize: fontSize.xs, marginTop: 2 },
  appPrice: { color: colors.skyBlue, fontWeight: "700", fontSize: fontSize.xs, marginTop: 2 },
  acceptBtn: { backgroundColor: colors.success, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.md },
  acceptBtnText: { color: colors.white, fontWeight: "700", fontSize: fontSize.xs },
  rejectBtn: { alignItems: "center", justifyContent: "center", width: 32, height: 28, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger + "50" },
});

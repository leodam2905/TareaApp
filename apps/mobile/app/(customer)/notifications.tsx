import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BackBar from "@/components/ui/BackBar";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";

type Notif = { id: string; title: string; body: string; type: string; isRead: boolean; refId: string | null; createdAt: string };

const typeColor: Record<string, string> = {
  booking_request:  C.sky,
  booking_accepted: C.emerald,
  booking_update:   C.amber,
  message:          "#A78BFA",
  payout:           C.emerald,
  system:           "#64748B",
};

const BOOKING_TYPES = new Set(["booking_request", "booking_accepted", "booking_update", "booking_cancelled", "booking_reminder", "chat_message", "message"]);

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifs,     setNotifs]     = useState<Notif[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get("/notifications");
    if (res.ok) setNotifs(await res.json());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const tap = async (n: Notif) => {
    if (!n.isRead) {
      await api.patch("/notifications", { id: n.id });
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x));
    }
    if (n.refId && BOOKING_TYPES.has(n.type)) {
      router.push({ pathname: "/(customer)/booking-detail" as any, params: { id: n.refId } });
    }
  };

  const markAllRead = async () => {
    await api.patch("/notifications", {});
    setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const unread = notifs.filter(n => !n.isRead).length;

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={C.sky} size="large" /></View>;

  return (
    <SafeAreaView style={s.safe}>
      <BackBar fallback="/(customer)/tabs/dashboard" />
      <View style={s.header}>
        <View>
          <Text style={s.title}>Notifications</Text>
          {unread > 0 && <Text style={s.unreadBadge}>{unread} unread</Text>}
        </View>
        {unread > 0 && (
          <TouchableOpacity onPress={markAllRead} style={s.markAllBtn}>
            <Text style={s.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.sky} />}
      >
        {notifs.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>🔔</Text>
            <Text style={s.emptyText}>No notifications yet</Text>
          </View>
        ) : notifs.map(n => (
          <TouchableOpacity
            key={n.id}
            style={[s.card, !n.isRead && s.cardUnread]}
            onPress={() => tap(n)}
            activeOpacity={0.7}
          >
            <View style={[s.dot, { backgroundColor: typeColor[n.type] ?? "#64748B" }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.notifTitle}>{n.title}</Text>
              <Text style={s.notifBody}>{n.body}</Text>
              <Text style={s.notifTime}>{timeAgo(n.createdAt)}</Text>
            </View>
            {!n.isRead && <View style={s.unreadDot} />}
          </TouchableOpacity>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#FFFFFF" },
  center:      { flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 24, paddingBottom: 12 },
  title:       { color: "#0F172A", fontSize: 26, fontWeight: "900" },
  unreadBadge: { color: C.sky, fontSize: 12, fontWeight: "700", marginTop: 2 },
  markAllBtn:  { backgroundColor: "rgba(56,189,248,0.12)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  markAllText: { color: C.sky, fontSize: 12, fontWeight: "700" },
  card:        { flexDirection: "row", alignItems: "flex-start", gap: 12, marginHorizontal: 16, marginBottom: 8, backgroundColor: "#F1F5F9", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  cardUnread:  { borderColor: "rgba(56,189,248,0.35)", backgroundColor: "#EFF8FF" },
  dot:         { width: 4, borderRadius: 2, height: "100%" as any, minHeight: 40, marginTop: 2 },
  notifTitle:  { color: "#0F172A", fontWeight: "700", fontSize: 14 },
  notifBody:   { color: "#64748B", fontSize: 13, marginTop: 3, lineHeight: 18 },
  notifTime:   { color: "#94A3B8", fontSize: 11, marginTop: 6 },
  unreadDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: C.sky, marginTop: 4 },
  empty:       { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyEmoji:  { fontSize: 48 },
  emptyText:   { color: "#64748B", fontSize: 15 },
});

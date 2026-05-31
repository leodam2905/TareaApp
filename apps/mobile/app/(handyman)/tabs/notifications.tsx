import { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";

type Notif = { id: string; title: string; body: string; type: string; isRead: boolean; refId: string | null; createdAt: string };

const TYPE_COLOR: Record<string, string> = {
  booking_request: C.sky,
  booking_accepted: C.emerald,
  booking_cancelled: C.red,
  booking_reminder: C.amber,
  chat_message: C.sky,
  payment: C.emerald,
  review: C.amber,
};

export default function HandymanNotifications() {
  const [notifs, setNotifs]     = useState<Notif[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    const res = await api.get("/notifications");
    if (res.ok) setNotifs(await res.json());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markAllRead = async () => {
    await api.patch("/notifications", { markAll: true });
    setNotifs(n => n.map(x => ({ ...x, isRead: true })));
  };

  const tap = async (n: Notif) => {
    if (!n.isRead) {
      await api.patch(`/notifications/${n.id}`, { isRead: true });
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x));
    }
    if (n.refId && (n.type === "booking_request" || n.type === "booking_accepted" || n.type === "chat_message")) {
      router.push({ pathname: "/(handyman)/job-detail" as any, params: { id: n.refId } });
    }
  };

  const unread = notifs.filter(n => !n.isRead).length;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Notifications</Text>
        {unread > 0 && (
          <TouchableOpacity onPress={markAllRead}><Text style={s.markAll}>Mark all read</Text></TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.sky} size="large" /></View>
      ) : notifs.length === 0 ? (
        <View style={s.center}><Text style={s.empty}>No notifications yet.</Text></View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={n => n.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.sky} />}
          renderItem={({ item: n }) => {
            const dot = TYPE_COLOR[n.type] ?? C.slate400;
            return (
              <TouchableOpacity style={[s.card, !n.isRead && s.cardUnread]} onPress={() => tap(n)}>
                <View style={[s.dot, { backgroundColor: dot }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.notifTitle, !n.isRead && s.notifTitleUnread]}>{n.title}</Text>
                  <Text style={s.notifBody} numberOfLines={2}>{n.body}</Text>
                  <Text style={s.notifTime}>{new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</Text>
                </View>
                {!n.isRead && <View style={s.unreadDot} />}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: C.ink },
  center:         { flex: 1, alignItems: "center", justifyContent: "center" },
  header:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 8 },
  title:          { color: C.white, fontSize: 24, fontWeight: "800" },
  markAll:        { color: C.sky, fontSize: 13, fontWeight: "600" },
  empty:          { color: C.slate400, fontSize: 15 },
  card:           { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "#1E293B", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  cardUnread:     { borderColor: "rgba(56,189,248,0.2)", backgroundColor: "#1A2440" },
  dot:            { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  notifTitle:     { color: C.slate400, fontSize: 14, fontWeight: "600", marginBottom: 2 },
  notifTitleUnread:{ color: C.white },
  notifBody:      { color: C.slate500, fontSize: 13, lineHeight: 18 },
  notifTime:      { color: C.slate600, fontSize: 11, marginTop: 4 },
  unreadDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: C.sky, marginTop: 5 },
});

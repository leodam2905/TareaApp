import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../constants/api";
import { colors, fontSize, radius, spacing } from "../constants/theme";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  refId: string | null;
  read: boolean;
  createdAt: string;
}

const TYPE_ICON: Record<string, { name: string; color: string }> = {
  booking_request: { name: "calendar", color: colors.skyBlue },
  booking_accepted: { name: "checkmark-circle", color: "#10B981" },
  booking_cancelled: { name: "close-circle", color: "#EF4444" },
  booking_completed: { name: "trophy", color: "#F59E0B" },
  booking_reminder: { name: "alarm", color: "#A78BFA" },
  message: { name: "chatbubble", color: colors.skyBlue },
  payment: { name: "card", color: "#10B981" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/notifications");
      setNotifications(Array.isArray(res.data) ? res.data : res.data.notifications ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    api.patch(`/notifications/${id}/read`).catch(() => {});
  };

  const handlePress = (n: Notification) => {
    if (!n.read) markRead(n.id);
    if (!n.refId) return;
    switch (n.type) {
      case "booking_request":
      case "booking_accepted":
      case "booking_cancelled":
      case "booking_completed":
      case "booking_reminder":
        router.push(`/booking/${n.refId}` as never);
        break;
      case "message":
        router.push(`/chat/${n.refId}` as never);
        break;
    }
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    api.patch("/notifications/read-all").catch(() => {});
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.skyBlue} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <Pressable onPress={markAllRead} style={styles.markAll}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.skyBlue} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={52} color={colors.inkSubtle} />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>We'll notify you about bookings and messages</Text>
          </View>
        }
        renderItem={({ item }) => {
          const icon = TYPE_ICON[item.type] ?? { name: "information-circle", color: colors.inkSubtle };
          return (
            <Pressable
              style={[styles.item, !item.read && styles.itemUnread]}
              onPress={() => handlePress(item)}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${icon.color}18` }]}>
                <Ionicons name={icon.name as never} size={20} color={icon.color} />
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.itemBody} numberOfLines={2}>{item.body}</Text>
                <Text style={styles.itemTime}>{timeAgo(item.createdAt)}</Text>
              </View>
              {!item.read && <View style={styles.unreadDot} />}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", paddingTop: 60,
    paddingBottom: spacing.md, paddingHorizontal: spacing.xl,
    backgroundColor: "#0F2560",
  },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: fontSize.xl, fontWeight: "800", color: colors.white, marginLeft: spacing.md },
  markAll: { paddingHorizontal: spacing.sm },
  markAllText: { color: colors.skyBlue, fontSize: fontSize.sm, fontWeight: "600" },
  list: { paddingVertical: spacing.sm },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: spacing.sm },
  emptyText: { color: colors.white, fontSize: fontSize.lg, fontWeight: "700" },
  emptySubtext: { color: colors.inkSubtle, fontSize: fontSize.sm, textAlign: "center", paddingHorizontal: spacing.xl },
  item: {
    flexDirection: "row", alignItems: "flex-start", gap: spacing.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.cardBorder,
  },
  itemUnread: { backgroundColor: "rgba(56,189,248,0.04)" },
  iconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 },
  itemContent: { flex: 1, gap: 3 },
  itemTitle: { color: colors.white, fontSize: fontSize.sm, fontWeight: "700" },
  itemBody: { color: colors.inkSubtle, fontSize: fontSize.xs, lineHeight: 18 },
  itemTime: { color: colors.inkSubtle, fontSize: fontSize.xs, marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.skyBlue, marginTop: 6, flexShrink: 0 },
});

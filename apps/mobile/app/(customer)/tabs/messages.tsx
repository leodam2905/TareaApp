import { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";

const BLUE = "#2563EB", INK = "#0F172A", MUTED = "#64748B", SURFACE = "#F1F5F9", LINE = "#E2E8F0";

type Booking = {
  id: string; status: string; scheduledAt: string;
  service: { title: string };
  handyman: { name: string; avatarUrl?: string | null };
};

const STATUS_LABEL: Record<string, string> = {
  ACCEPTED: "Booking confirmed", IN_PROGRESS: "Job in progress", COMPLETED: "Completed", PENDING: "Awaiting response",
};

export default function MessagesScreen() {
  const router = useRouter();
  const [threads, setThreads] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await api.get("/bookings?role=customer");
      if (res.ok) {
        const all: Booking[] = await res.json();
        // A conversation exists once a pro is engaged (not cancelled).
        setThreads(all.filter(b => ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "PENDING"].includes(b.status)));
      }
    } finally { setLoading(false); setRefreshing(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) return <View style={s.center}><ActivityIndicator color={BLUE} size="large" /></View>;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}><Text style={s.title}>Messages</Text></View>
      <FlatList
        data={threads}
        keyExtractor={b => b.id}
        contentContainerStyle={threads.length === 0 ? { flex: 1 } : { paddingVertical: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={BLUE} />}
        ListEmptyComponent={
          <View style={s.center}>
            <Ionicons name="chatbubbles-outline" size={48} color="#CBD5E1" />
            <Text style={s.emptyTitle}>No messages yet</Text>
            <Text style={s.emptyText}>Once you book a pro, your conversation appears here.</Text>
          </View>
        }
        renderItem={({ item: b }) => (
          <TouchableOpacity style={s.row} activeOpacity={0.8}
            onPress={() => router.push({ pathname: "/(customer)/chat" as any, params: { bookingId: b.id, otherName: b.handyman.name } })}>
            {b.handyman.avatarUrl
              ? <Image source={{ uri: b.handyman.avatarUrl }} style={s.avatar} />
              : <View style={[s.avatar, s.avatarFallback]}><Text style={s.avatarInit}>{b.handyman.name[0]}</Text></View>}
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={1}>{b.handyman.name}</Text>
              <Text style={s.preview} numberOfLines={1}>{b.service.title} · {STATUS_LABEL[b.status] ?? b.status}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: "#FFFFFF" },
  center:        { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 32 },
  header:        { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title:         { color: INK, fontSize: 26, fontWeight: "900" },
  row:           { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: LINE },
  avatar:        { width: 50, height: 50, borderRadius: 25, backgroundColor: SURFACE },
  avatarFallback:{ alignItems: "center", justifyContent: "center" },
  avatarInit:    { color: BLUE, fontSize: 20, fontWeight: "800" },
  name:          { color: INK, fontSize: 15, fontWeight: "800" },
  preview:       { color: MUTED, fontSize: 13, marginTop: 2 },
  emptyTitle:    { color: INK, fontSize: 17, fontWeight: "800", marginTop: 6 },
  emptyText:     { color: MUTED, fontSize: 14, textAlign: "center", lineHeight: 20 },
});

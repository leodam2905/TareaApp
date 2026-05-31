import { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";

type Booking = { id: string; status: string; service: { title: string; category: string }; handyman: { name: string }; scheduledAt: string; totalPrice: number };

const FILTERS = ["ALL", "PENDING", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

const STATUS_COLOR: Record<string, string> = {
  PENDING: C.amber, ACCEPTED: C.sky, IN_PROGRESS: C.orange, COMPLETED: C.emerald, CANCELLED: C.red,
};

export default function CustomerBookings() {
  const router = useRouter();
  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [filter, setFilter]       = useState<string>("ALL");
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await api.get("/bookings");
      if (res.ok) setBookings(await res.json());
    } finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const filtered = filter === "ALL" ? bookings : bookings.filter(b => b.status === filter);

  const renderItem = ({ item: b }: { item: Booking }) => (
    <TouchableOpacity style={s.card} onPress={() => router.push({ pathname: "/(customer)/booking-detail" as any, params: { id: b.id } })}>
      <View style={s.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.serviceTitle}>{b.service.title}</Text>
          <Text style={s.meta}>{b.handyman.name}</Text>
          <Text style={s.meta}>{new Date(b.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</Text>
        </View>
        <View>
          <View style={[s.badge, { backgroundColor: (STATUS_COLOR[b.status] ?? C.slate400) + "22" }]}>
            <Text style={[s.badgeText, { color: STATUS_COLOR[b.status] ?? C.slate400 }]}>{b.status.replace("_", " ")}</Text>
          </View>
          <Text style={s.price}>${b.totalPrice}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>My Bookings</Text>
      </View>

      {/* Filter bar */}
      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={f => f}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterBar}
        renderItem={({ item: f }) => (
          <TouchableOpacity
            style={[s.filterChip, filter === f && s.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterText, filter === f && s.filterTextActive]}>
              {f.replace("_", " ")}
            </Text>
          </TouchableOpacity>
        )}
      />

      {loading
        ? <View style={s.center}><ActivityIndicator color={C.sky} size="large" /></View>
        : filtered.length === 0
          ? <View style={s.center}><Text style={s.empty}>No bookings{filter !== "ALL" ? ` with status ${filter}` : ""}.</Text></View>
          : <FlatList
              data={filtered}
              keyExtractor={b => b.id}
              renderItem={renderItem}
              contentContainerStyle={{ padding: 16, gap: 12 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.sky} />}
            />
      }
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: C.ink },
  center:          { flex: 1, alignItems: "center", justifyContent: "center" },
  header:          { padding: 20, paddingBottom: 8 },
  title:           { color: C.white, fontSize: 24, fontWeight: "800" },
  filterBar:       { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip:      { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#1E293B", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  filterChipActive:{ backgroundColor: C.sky + "22", borderColor: C.sky },
  filterText:      { color: C.slate400, fontSize: 12, fontWeight: "600" },
  filterTextActive:{ color: C.sky },
  card:            { backgroundColor: "#1E293B", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  cardTop:         { flexDirection: "row", gap: 12 },
  serviceTitle:    { color: C.white, fontSize: 15, fontWeight: "800" },
  meta:            { color: C.slate400, fontSize: 12, marginTop: 2 },
  badge:           { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-end" },
  badgeText:       { fontSize: 10, fontWeight: "700" },
  price:           { color: C.emerald, fontWeight: "800", fontSize: 15, textAlign: "right", marginTop: 6 },
  empty:           { color: C.slate400, fontSize: 15 },
});
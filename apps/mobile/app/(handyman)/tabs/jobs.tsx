import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";
import { SafeAreaView } from "react-native-safe-area-context";

type Booking = { id: string; status: string; scheduledAt: string; totalPrice: number; service: { title: string }; customer: { name: string; avatarUrl: string | null } };

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  PENDING:     { bg: "rgba(245,158,11,0.15)", text: C.amber },
  ACCEPTED:    { bg: "rgba(56,189,248,0.15)",  text: C.sky },
  IN_PROGRESS: { bg: "rgba(56,189,248,0.15)",  text: C.sky },
  COMPLETED:   { bg: "rgba(16,185,129,0.15)",  text: C.emerald },
  CANCELLED:   { bg: "rgba(239,68,68,0.15)",   text: C.red },
  DISPUTED:    { bg: "rgba(239,68,68,0.15)",   text: C.red },
};

export default function MyJobsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]     = useState("ALL");

  const load = useCallback(async () => {
    const res = await api.get("/bookings?role=handyman");
    if (res.ok) { const d = await res.json(); setBookings(Array.isArray(d) ? d : []); }
    setLoading(false); setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = bookings.filter(b => filter === "ALL" ? true : b.status === filter);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.sky} />}>
        <View style={s.header}>
          <Text style={s.title}>My Jobs</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          {["ALL", "PENDING", "ACCEPTED", "IN_PROGRESS", "COMPLETED"].map(f => (
            <TouchableOpacity key={f} style={[s.filterBtn, filter === f && s.filterActive]} onPress={() => setFilter(f)}>
              <Text style={[s.filterText, filter === f && s.filterTextActive]}>{f.replace("_", " ")}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading && <ActivityIndicator color={C.sky} style={{ marginTop: 40 }} />}
        {!loading && filtered.length === 0 && (
          <View style={s.empty}><Text style={s.emptyText}>No jobs found</Text></View>
        )}
        {!loading && filtered.map(b => {
          const sc = STATUS_COLOR[b.status] ?? STATUS_COLOR.PENDING;
          return (
            <TouchableOpacity key={b.id} style={s.card} onPress={() => router.push({ pathname: "/(handyman)/job-detail" as any, params: { id: b.id } })}>
              <View style={s.cardTop}>
                <View style={s.avatar}><Text style={s.avatarText}>{b.customer.name[0]?.toUpperCase()}</Text></View>
                <View style={s.cardInfo}>
                  <Text style={s.serviceTitle}>{b.service.title}</Text>
                  <Text style={s.customerName}>{b.customer.name}</Text>
                  <Text style={s.date}>📅 {new Date(b.scheduledAt).toLocaleDateString()}</Text>
                </View>
                <View style={s.rightCol}>
                  <Text style={s.price}>${b.totalPrice.toFixed(0)}</Text>
                  <View style={[s.badge, { backgroundColor: sc.bg }]}>
                    <Text style={[s.badgeText, { color: sc.text }]}>{b.status.replace("_", " ")}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: C.bg },
  scroll:          { flex: 1 },
  header:          { padding: 24, paddingBottom: 12 },
  title:           { color: C.text, fontSize: 28, fontWeight: "900" },
  filters:         { paddingHorizontal: 16, gap: 8, paddingBottom: 16 },
  filterBtn:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
  filterActive:    { backgroundColor: C.sky },
  filterText:      { color: C.textMuted, fontSize: 12, fontWeight: "600" },
  filterTextActive:{ color: C.ink },
  empty:           { alignItems: "center", padding: 48 },
  emptyText:       { color: C.slate500, fontSize: 15 },
  card:            { marginHorizontal: 16, marginBottom: 10, backgroundColor: C.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.line },
  cardTop:         { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar:          { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(56,189,248,0.2)", alignItems: "center", justifyContent: "center" },
  avatarText:      { color: C.sky, fontWeight: "800", fontSize: 16 },
  cardInfo:        { flex: 1 },
  serviceTitle:    { color: C.text, fontWeight: "700", fontSize: 14 },
  customerName:    { color: C.textMuted, fontSize: 12, marginTop: 1 },
  date:            { color: C.slate500, fontSize: 11, marginTop: 2 },
  rightCol:        { alignItems: "flex-end", gap: 4 },
  price:           { color: C.emerald, fontWeight: "800", fontSize: 15 },
  badge:           { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText:       { fontSize: 10, fontWeight: "700" },
});

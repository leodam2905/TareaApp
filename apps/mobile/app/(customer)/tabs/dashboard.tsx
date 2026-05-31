import { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";

type Booking = { id: string; status: string; service: { title: string }; handyman: { name: string }; scheduledAt: string };

export default function CustomerDashboard() {
  const router = useRouter();
  const [name, setName]         = useState("");
  const [recent, setRecent]     = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [pRes, bRes] = await Promise.all([api.get("/profile"), api.get("/bookings")]);
      if (pRes.ok) { const p = await pRes.json(); setName(p.name ?? ""); }
      if (bRes.ok) { const b = await bRes.json(); setRecent((b as Booking[]).slice(0, 3)); }
    } finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const statusColor = (s: string) =>
    ({ PENDING: C.amber, ACCEPTED: C.sky, IN_PROGRESS: C.orange, COMPLETED: C.emerald, CANCELLED: C.red }[s] ?? C.slate400);

  if (loading) return <View style={s.center}><ActivityIndicator color={C.sky} size="large" /></View>;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.sky} />}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>Hello, {name.split(" ")[0] || "there"} 👋</Text>
            <Text style={s.sub}>What do you need help with today?</Text>
          </View>
          <TouchableOpacity style={s.avatarBtn} onPress={() => router.push("/(customer)/tabs/profile" as any)}>
            <Text style={s.avatarText}>{name ? name[0].toUpperCase() : "?"}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.grid}>
          {[
            { emoji: "🔍", label: "Browse Pros",    route: "/(customer)/tabs/browse" },
            { emoji: "➕", label: "Post a Job",     route: "/(customer)/tabs/post-job" },
            { emoji: "📋", label: "My Bookings",    route: "/(customer)/tabs/bookings" },
            { emoji: "🔔", label: "Notifications",  route: "/(customer)/tabs/notifications" },
            { emoji: "💰", label: "Spending",       route: "/(customer)/tabs/spending" },
            { emoji: "👤", label: "My Profile",     route: "/(customer)/tabs/profile" },
          ].map(({ emoji, label, route }) => (
            <TouchableOpacity key={label} style={s.card} onPress={() => router.push(route as any)}>
              <Text style={s.cardEmoji}>{emoji}</Text>
              <Text style={s.cardLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Recent Bookings</Text>
          {recent.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>No bookings yet.</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => router.push("/(customer)/tabs/browse" as any)}>
                <Text style={s.emptyBtnText}>Browse Handymen →</Text>
              </TouchableOpacity>
            </View>
          ) : recent.map(b => (
            <View key={b.id} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{b.service.title}</Text>
                <Text style={s.rowMeta}>{b.handyman.name} · {new Date(b.scheduledAt).toLocaleDateString()}</Text>
              </View>
              <View style={[s.badge, { backgroundColor: statusColor(b.status) + "22" }]}>
                <Text style={[s.badgeText, { color: statusColor(b.status) }]}>{b.status}</Text>
              </View>
            </View>
          ))}
          {recent.length > 0 && (
            <TouchableOpacity onPress={() => router.push("/(customer)/tabs/bookings" as any)} style={s.seeAll}>
              <Text style={s.seeAllText}>See all →</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.ink },
  center:       { flex: 1, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  header:       { padding: 24, paddingBottom: 16, flexDirection: "row", alignItems: "center" },
  avatarBtn:    { width: 42, height: 42, borderRadius: 21, backgroundColor: C.sky, alignItems: "center", justifyContent: "center" },
  avatarText:   { color: C.ink, fontWeight: "900", fontSize: 18 },
  greeting:     { color: C.white, fontSize: 24, fontWeight: "800" },
  sub:          { color: C.slate400, fontSize: 14, marginTop: 4 },
  grid:         { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 12, marginBottom: 8 },
  card:         { flex: 1, minWidth: "28%", backgroundColor: "#1E293B", borderRadius: 16, padding: 18, alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  cardEmoji:    { fontSize: 26 },
  cardLabel:    { color: C.white, fontSize: 12, fontWeight: "700", textAlign: "center" },
  section:      { margin: 16, backgroundColor: "#1E293B", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  sectionTitle: { color: C.white, fontSize: 16, fontWeight: "800", marginBottom: 12 },
  row:          { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  rowTitle:     { color: C.white, fontWeight: "700", fontSize: 14 },
  rowMeta:      { color: C.slate400, fontSize: 12, marginTop: 2 },
  badge:        { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:    { fontSize: 10, fontWeight: "700" },
  seeAll:       { marginTop: 10, alignItems: "center" },
  seeAllText:   { color: C.sky, fontWeight: "700", fontSize: 13 },
  empty:        { alignItems: "center", paddingVertical: 20, gap: 12 },
  emptyText:    { color: C.slate400, fontSize: 14 },
  emptyBtn:     { backgroundColor: C.sky, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: C.ink, fontWeight: "800", fontSize: 13 },
});
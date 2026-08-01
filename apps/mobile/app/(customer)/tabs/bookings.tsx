import { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";

const BLUE = "#2563EB", INK = "#0F172A", MUTED = "#64748B", SURFACE = "#F1F5F9", LINE = "#E2E8F0", GREEN = "#10B981";

type Booking = {
  id: string; status: string; address: string | null; city: string | null;
  service: { title: string; category: string }; handyman: { name: string; avatarUrl?: string | null };
  scheduledAt: string; totalPrice: number;
};

const FILTERS = [
  { key: "ALL",         label: "All",         icon: "grid-outline" },
  { key: "UPCOMING",    label: "Upcoming",    icon: "calendar-outline" },
  { key: "IN_PROGRESS", label: "In Progress", icon: "time-outline" },
  { key: "COMPLETED",   label: "Completed",   icon: "checkmark-circle-outline" },
  { key: "CANCELLED",   label: "Cancelled",   icon: "close-circle-outline" },
] as const;

const prettyCat = (c: string) => c.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, m => m.toUpperCase());
const isUpcoming = (b: Booking) => ["PENDING", "ACCEPTED"].includes(b.status);
const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:     { label: "Pending",     color: "#B45309", bg: "#FEF3C7" },
  ACCEPTED:    { label: "Confirmed",   color: "#15803D", bg: "#DCFCE7" },
  IN_PROGRESS: { label: "In progress", color: "#C2410C", bg: "#FFEDD5" },
  COMPLETED:   { label: "Completed",   color: "#15803D", bg: "#DCFCE7" },
  CANCELLED:   { label: "Cancelled",   color: "#B91C1C", bg: "#FEE2E2" },
};

export default function CustomerBookings() {
  const router = useRouter();
  const [bookings, setBookings]   = useState<Booking[]>([]);
  const [unread, setUnread]       = useState(0);
  const [filter, setFilter]       = useState<string>("ALL");
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [bRes, nRes] = await Promise.all([api.get("/bookings?role=customer"), api.get("/notifications")]);
      if (bRes.ok) setBookings(await bRes.json());
      if (nRes.ok) { const n = await nRes.json(); setUnread(Array.isArray(n) ? n.filter((x: any) => !x.isRead).length : 0); }
    } finally { setLoading(false); setRefreshing(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const upcoming    = bookings.filter(isUpcoming).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  const inProgress  = bookings.filter(b => b.status === "IN_PROGRESS");
  const completed   = bookings.filter(b => b.status === "COMPLETED");
  const cancelled   = bookings.filter(b => b.status === "CANCELLED");
  const go = (path: string) => router.push(path as any);

  const nextLabel = upcoming[0]
    ? `Next: ${new Date(upcoming[0].scheduledAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : "None scheduled";

  const stats = [
    { n: upcoming.length,   label: "Upcoming",    sub: nextLabel,   icon: "calendar", color: BLUE },
    { n: inProgress.length, label: "In Progress", sub: "Right now",  icon: "ellipse-outline", color: GREEN },
    { n: completed.length,  label: "Completed",   sub: "All time",   icon: "checkmark-circle", color: "#7C3AED" },
    { n: cancelled.length,  label: "Cancelled",   sub: "All time",   icon: "close-circle", color: "#EF4444" },
  ] as const;

  const filteredList = filter === "UPCOMING" ? upcoming
    : filter === "IN_PROGRESS" ? inProgress
    : filter === "COMPLETED" ? completed
    : filter === "CANCELLED" ? cancelled
    : bookings;

  const card = (b: Booking) => {
    const st = STATUS[b.status] ?? { label: b.status, color: MUTED, bg: SURFACE };
    const active = ["ACCEPTED", "IN_PROGRESS"].includes(b.status);
    return (
      <TouchableOpacity key={b.id} style={s.bCard} activeOpacity={0.9} onPress={() => go(`/(customer)/booking-detail?id=${b.id}`)}>
        <View style={s.bTop}>
          {b.handyman.avatarUrl
            ? <Image source={{ uri: b.handyman.avatarUrl }} style={s.avatar} />
            : <View style={[s.avatar, s.avatarFallback]}><Text style={s.avatarInit}>{b.handyman.name[0]}</Text></View>}
          <View style={{ flex: 1 }}>
            <View style={s.bTitleRow}>
              <Text style={s.bTitle} numberOfLines={1}>{b.service.title}</Text>
              <View style={[s.statusPill, { backgroundColor: st.bg }]}><Text style={[s.statusText, { color: st.color }]}>{st.label}</Text></View>
            </View>
            <View style={s.bMetaRow}><Ionicons name="calendar-outline" size={13} color={MUTED} /><Text style={s.bMeta}>{new Date(b.scheduledAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {new Date(b.scheduledAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</Text></View>
            {b.address ? <View style={s.bMetaRow}><Ionicons name="location-outline" size={13} color={MUTED} /><Text style={s.bMeta} numberOfLines={1}>{b.address}{b.city ? `, ${b.city}` : ""}</Text></View> : null}
          </View>
        </View>
        <View style={s.bBottom}>
          <View>
            <Text style={s.bName}>{b.handyman.name} · <Text style={s.bTrade}>{prettyCat(b.service.category)} Pro</Text></Text>
            <Text style={s.aiLabel}>AI Fixed Price</Text>
            <Text style={s.price}>${b.totalPrice}</Text>
          </View>
          <TouchableOpacity style={s.trackBtn} onPress={() => go(`/(customer)/booking-detail?id=${b.id}`)}>
            <Ionicons name={active ? "navigate" : "eye-outline"} size={15} color={BLUE} />
            <Text style={s.trackText}>{active ? "Track Pro" : "View"}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={BLUE} size="large" /></View>;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={BLUE} />}>

        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Bookings</Text>
            <Text style={s.sub}>Manage all your bookings in one place.</Text>
          </View>
          <TouchableOpacity style={s.bell} onPress={() => go("/(customer)/notifications")} hitSlop={8}>
            <Ionicons name="notifications-outline" size={24} color={INK} />
            {unread > 0 && <View style={s.bellBadge}><Text style={s.bellBadgeText}>{unread > 9 ? "9+" : unread}</Text></View>}
          </TouchableOpacity>
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterBar} style={{ flexGrow: 0 }}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f.key} style={[s.chip, filter === f.key && s.chipOn]} onPress={() => setFilter(f.key)}>
              <Ionicons name={f.icon} size={15} color={filter === f.key ? "#fff" : MUTED} />
              <Text style={[s.chipText, filter === f.key && { color: "#fff" }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Stats */}
        <View style={s.statsRow}>
          {stats.map(st => (
            <View key={st.label} style={s.stat}>
              <View style={[s.statIcon, { backgroundColor: st.color + "1A" }]}><Ionicons name={st.icon as any} size={20} color={st.color} /></View>
              <Text style={s.statN}>{st.n}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
              <Text style={[s.statSub, st.label === "Upcoming" && { color: BLUE }]}>{st.sub}</Text>
            </View>
          ))}
        </View>

        {filter === "ALL" ? <>
          {/* Illustration */}
          <Image source={require("../../../assets/bookings-illustration.png")} style={s.illustration} resizeMode="contain" />

          {/* Support */}
          <View style={s.support}>
            <View style={s.supportIcon}><Ionicons name="headset-outline" size={22} color={BLUE} /></View>
            <View style={{ flex: 1 }}><Text style={s.supportTitle}>Need help?</Text><Text style={s.supportSub}>Our support team is here for you.</Text></View>
            <TouchableOpacity style={s.supportBtn} onPress={() => Linking.openURL("mailto:support@taptarea.com?subject=Tarea%20Support")}><Ionicons name="chatbubble-ellipses-outline" size={15} color={BLUE} /><Text style={s.supportBtnText}>Contact</Text></TouchableOpacity>
          </View>
        </> : (
          <View style={{ paddingHorizontal: 16, gap: 12, marginTop: 8 }}>
            {filteredList.length === 0
              ? <View style={s.emptyCard}><View style={{ flex: 1 }}><Text style={s.emptyTitle}>Nothing here yet</Text><Text style={s.emptySub}>No {filter.replace("_", " ").toLowerCase()} bookings.</Text></View></View>
              : filteredList.map(card)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: "#F6F8FC" },
  center:        { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F6F8FC" },
  header:        { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  title:         { color: INK, fontSize: 30, fontWeight: "900", letterSpacing: -0.5 },
  sub:           { color: MUTED, fontSize: 14, marginTop: 2 },
  bell:          { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  bellBadge:     { position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: "#F6F8FC" },
  bellBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },

  filterBar:     { paddingHorizontal: 16, gap: 8, paddingBottom: 14 },
  chip:          { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", borderRadius: 22, paddingHorizontal: 14, minHeight: 40, paddingVertical: 6, borderWidth: 1, borderColor: LINE },
  chipOn:        { backgroundColor: BLUE, borderColor: BLUE },
  chipText:      { color: MUTED, fontSize: 13, fontWeight: "700" },

  statsRow:      { flexDirection: "row", paddingHorizontal: 16, gap: 10 },
  stat:          { flex: 1, backgroundColor: "#fff", borderRadius: 16, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "#EEF2F7" },
  statIcon:      { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  statN:         { color: INK, fontSize: 22, fontWeight: "900" },
  statLabel:     { color: INK, fontSize: 11, fontWeight: "700", marginTop: 2 },
  statSub:       { color: MUTED, fontSize: 9.5, marginTop: 2 },

  illustration:  { width: "58%", height: 180, alignSelf: "center", marginTop: 16, marginBottom: 4 },
  secHead:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginTop: 22, marginBottom: 10 },
  secTitle:      { color: INK, fontSize: 17, fontWeight: "800" },
  link:          { color: BLUE, fontSize: 13, fontWeight: "700" },

  bCard:         { marginHorizontal: 16, backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#EEF2F7" },
  bTop:          { flexDirection: "row", gap: 12 },
  avatar:        { width: 56, height: 56, borderRadius: 28, backgroundColor: SURFACE },
  avatarFallback:{ alignItems: "center", justifyContent: "center" },
  avatarInit:    { color: BLUE, fontSize: 22, fontWeight: "800" },
  bTitleRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  bTitle:        { color: INK, fontSize: 16, fontWeight: "800", flex: 1 },
  statusPill:    { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:    { fontSize: 11, fontWeight: "800" },
  bMetaRow:      { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  bMeta:         { color: MUTED, fontSize: 12.5, flex: 1 },
  bBottom:       { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 14, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 12 },
  bName:         { color: INK, fontSize: 13, fontWeight: "800" },
  bTrade:        { color: MUTED, fontWeight: "600" },
  aiLabel:       { color: MUTED, fontSize: 11, marginTop: 6 },
  price:         { color: INK, fontSize: 20, fontWeight: "900" },
  trackBtn:      { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderColor: "#C7D7FF", borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10 },
  trackText:     { color: BLUE, fontSize: 14, fontWeight: "800" },

  emptyCard:     { flexDirection: "row", alignItems: "center", gap: 14, marginHorizontal: 16, backgroundColor: "#fff", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "#EEF2F7" },
  emptyIcon:     { width: 44, height: 44, borderRadius: 22, backgroundColor: "#EFF5FF", alignItems: "center", justifyContent: "center" },
  emptyTitle:    { color: INK, fontSize: 15, fontWeight: "800" },
  emptySub:      { color: MUTED, fontSize: 13, marginTop: 2, lineHeight: 18 },

  support:       { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginTop: 22, backgroundColor: "#EFF5FF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#DBE7FF" },
  supportIcon:   { width: 44, height: 44, borderRadius: 22, backgroundColor: "#DBE7FF", alignItems: "center", justifyContent: "center" },
  supportTitle:  { color: INK, fontSize: 15, fontWeight: "800" },
  supportSub:    { color: MUTED, fontSize: 12.5, marginTop: 2 },
  supportBtn:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#C7D7FF" },
  supportBtnText:{ color: BLUE, fontSize: 13, fontWeight: "800" },
});

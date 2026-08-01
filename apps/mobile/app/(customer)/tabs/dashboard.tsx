import { useState, useCallback, useRef, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";

// Action card that fades + slides up on mount, staggered by index.
function ActionCard({ index, style, onPress, children }: { index: number; style: any; onPress: () => void; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, delay: index * 110, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ width: "47%", flexGrow: 1, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }}>
      <TouchableOpacity style={style} activeOpacity={0.85} onPress={onPress}>{children}</TouchableOpacity>
    </Animated.View>
  );
}

const BLUE = "#2563EB";
const INK = "#0F172A";
const MUTED = "#64748B";
const SURFACE = "#F1F5F9";
const LINE = "#E2E8F0";
const GREEN = "#10B981";

type Booking = {
  id: string; status: string;
  service: { title: string; category: string };
  handyman: { name: string; avatarUrl?: string | null };
  scheduledAt: string; totalPrice: number;
};
type Pro = {
  id: string; name: string; avatarUrl: string | null;
  handymanProfile: { hourlyRate: number | null; rating: number | null; totalJobs: number } | null;
  services: { title: string; category: string }[];
};

const CATEGORIES: { label: string; value: string; icon: React.ComponentProps<typeof Ionicons>["name"]; desc?: string }[] = [
  { label: "Plumbing",    value: "PLUMBING",         icon: "water-outline" },
  { label: "Electrical",  value: "ELECTRICAL",       icon: "flash-outline" },
  { label: "Cleaning",    value: "CLEANING",         icon: "sparkles-outline" },
  { label: "Painting",    value: "PAINTING",         icon: "color-palette-outline" },
  { label: "Carpentry",   value: "CARPENTRY",        icon: "hammer-outline" },
  { label: "Appliance",   value: "APPLIANCE_REPAIR", icon: "cube-outline" },
  { label: "Landscaping", value: "LANDSCAPING",      icon: "leaf-outline" },
  { label: "Laundry",     value: "LAUNDRY",          icon: "shirt-outline" },
  { label: "Moving",      value: "MOVING",           icon: "cube-outline" },
];

const prettyCat = (c: string) => c.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, m => m.toUpperCase());

export default function CustomerDashboard() {
  const router = useRouter();
  const [name, setName]     = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pros, setPros]     = useState<Pro[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [pRes, bRes, hRes, nRes] = await Promise.all([
        api.get("/profile"),
        api.get("/bookings?role=customer"),
        api.get("/handyman/browse"),
        api.get("/notifications"),
      ]);
      if (pRes.ok) { const p = await pRes.json(); setName(p.name ?? ""); setAvatar(p.avatarUrl ?? null); }
      if (bRes.ok) setBookings(await bRes.json());
      if (hRes.ok) setPros((await hRes.json() as Pro[]).slice(0, 6));
      if (nRes.ok) { const n = await nRes.json(); setUnread(Array.isArray(n) ? n.filter((x: any) => !x.isRead).length : 0); }
    } finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  if (loading) return <View style={s.center}><ActivityIndicator color={BLUE} size="large" /></View>;

  const hr = new Date().getHours();
  const greeting = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  const active = bookings.find(b => b.status === "IN_PROGRESS" || b.status === "ACCEPTED");
  const recent = bookings.filter(b => ["COMPLETED", "CANCELLED"].includes(b.status)).slice(0, 3);
  const go = (path: string) => router.push(path as any);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={BLUE} />}>

        {/* Top bar: brand (left), bell + avatar (right) */}
        <View style={s.topbar}>
          <View style={s.brandRow}>
            <Image source={require("../../../assets/tarea-home-mark.png")} style={s.brandLogo} resizeMode="contain" />
            <View>
              <Text style={s.brand}>Tarea</Text>
              <Text style={s.brandSub}>Home</Text>
            </View>
          </View>
          <View style={s.topRight}>
            <TouchableOpacity style={s.bell} onPress={() => go("/(customer)/notifications")} hitSlop={8}>
              <Ionicons name="notifications-outline" size={24} color={INK} />
              {unread > 0 && <View style={s.bellBadge}><Text style={s.bellBadgeText}>{unread > 9 ? "9+" : unread}</Text></View>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => go("/(customer)/tabs/profile")}>
              {avatar
                ? <Image source={{ uri: avatar }} style={s.avatar} />
                : <View style={[s.avatar, s.avatarFallback]}><Text style={s.avatarInitial}>{name ? name[0].toUpperCase() : "?"}</Text></View>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Greeting */}
        <View style={s.greetRow}>
          <Text style={s.greeting}>{greeting}</Text>
          <Text style={s.name}>{name ? name.split(" ")[0] : "there"}</Text>
        </View>

        {/* Quick actions */}
        <View style={s.actionsGrid}>
          {[
            { label: "Post a Job",    desc: "Tell us what you need done",       img: require("../../../assets/action-postjob.png"),  route: "/(customer)/post-job" },
            { label: "Find Pros",     desc: "Discover trusted pros & reviews",  img: require("../../../assets/action-findpros.png"), route: "/(customer)/browse" },
            { label: "AI Diagnose",   desc: "Upload a photo, get AI insights",  img: require("../../../assets/action-diagnose.png"), route: "/diagnose" },
            { label: "Instant Quote", desc: "Get an estimated price fast",       img: require("../../../assets/action-quote.png"),    route: "/instant-quote" },
          ].map((a, i) => (
            <ActionCard key={a.label} index={i} style={s.actionSquare} onPress={() => go(a.route)}>
              <Image source={a.img} style={s.actionImg} resizeMode="contain" />
              <Text style={s.actionLabel}>{a.label}</Text>
              <Text style={s.actionDesc}>{a.desc}</Text>
            </ActionCard>
          ))}
        </View>

        {/* Active job */}
        {active && (
          <TouchableOpacity style={s.activeCard} activeOpacity={0.9}
            onPress={() => go(`/(customer)/booking-detail?id=${active.id}`)}>
            <View style={s.activeCircle} />
            <View style={s.activeRow}>
              {active.handyman.avatarUrl
                ? <Image source={{ uri: active.handyman.avatarUrl }} style={s.activeAvatar} />
                : <View style={[s.activeAvatar, s.activeAvatarFallback]}><Text style={s.activeAvatarInit}>{active.handyman.name[0]}</Text></View>}
              <View style={{ flex: 1 }}>
                <Text style={s.activeLabel}>{active.status === "IN_PROGRESS" ? "Job in progress" : "Booking confirmed"}</Text>
                <Text style={s.activeName}>{active.handyman.name} {active.status === "IN_PROGRESS" ? "is on the way" : "will arrive soon"}</Text>
              </View>
            </View>
            <View style={s.progressTrack}><View style={[s.progressFill, { width: active.status === "IN_PROGRESS" ? "68%" : "25%" }]} /></View>
            <Text style={s.activeCaption}>{active.service.title} · {prettyCat(active.service.category)}</Text>
          </TouchableOpacity>
        )}

        {/* Categories */}
        <Text style={s.sectionTitle}>Categories</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
          {CATEGORIES.map(c => (
            <TouchableOpacity key={c.label} style={s.catItem} onPress={() => router.push({ pathname: "/(customer)/post-job" as any, params: { category: c.value, ...(c.desc ? { description: c.desc } : {}) } })}>
              <View style={s.catTile}><Ionicons name={c.icon} size={24} color={BLUE} /></View>
              <Text style={s.catLabel} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Promo */}
        <View style={s.promo}>
          <View style={{ flex: 1 }}>
            <Text style={s.promoBig}>20% off</Text>
            <Text style={s.promoTitle}>your first job</Text>
            <Text style={s.promoSub}>Use code TAREA20 on any first order</Text>
          </View>
          <Ionicons name="sparkles" size={40} color="#F59E0B" />
        </View>

        {/* Recommended */}
        {pros.length > 0 && (
          <>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>Recommended near you</Text>
              <TouchableOpacity onPress={() => go("/(customer)/browse")}><Text style={s.link}>See all</Text></TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.proRow}>
              {pros.map(p => {
                const trade = p.services[0] ? prettyCat(p.services[0].category) : "Handyman";
                return (
                  <TouchableOpacity key={p.id} style={s.proCard} activeOpacity={0.9}
                    onPress={() => router.push({ pathname: "/(customer)/handyman-detail" as any, params: { userId: p.id } })}>
                    {p.avatarUrl
                      ? <Image source={{ uri: p.avatarUrl }} style={s.proPhoto} />
                      : <View style={[s.proPhoto, s.proPhotoFallback]}><Text style={s.proPhotoInit}>{p.name[0]}</Text></View>}
                    <Text style={s.proName} numberOfLines={1}>{p.name}</Text>
                    <Text style={s.proTrade} numberOfLines={1}>{trade}</Text>
                    <View style={s.proMetaRow}>
                      <Text style={s.proRating}>★ {p.handymanProfile?.rating?.toFixed(1) ?? "New"}</Text>
                      {p.handymanProfile?.hourlyRate != null && <Text style={s.proRate}>${p.handymanProfile.hourlyRate}/hr</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Recent activity */}
        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>Recent activity</Text>
          {recent.length > 0 && <TouchableOpacity onPress={() => go("/(customer)/tabs/bookings")}><Text style={s.link}>See all</Text></TouchableOpacity>}
        </View>
        {recent.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyText}>No past jobs yet.</Text>
          </View>
        ) : recent.map(b => (
          <TouchableOpacity key={b.id} style={s.actRow} activeOpacity={0.8} onPress={() => go(`/(customer)/booking-detail?id=${b.id}`)}>
            <View style={s.actIcon}><Ionicons name="checkmark-done" size={20} color={b.status === "COMPLETED" ? GREEN : MUTED} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.actTitle} numberOfLines={1}>{b.service.title}</Text>
              <Text style={s.actMeta}>{new Date(b.scheduledAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {b.handyman.name}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.actPrice}>${b.totalPrice}</Text>
              <Text style={[s.actStatus, { color: b.status === "COMPLETED" ? GREEN : MUTED }]}>{prettyCat(b.status)}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: "#FFFFFF" },
  center:          { flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  topbar:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12 },
  brandRow:        { flexDirection: "row", alignItems: "center", gap: 8 },
  brandLogo:       { width: 34, height: 34, borderRadius: 8 },
  brand:           { fontSize: 20, fontWeight: "900", color: BLUE, letterSpacing: -0.5, lineHeight: 22 },
  brandSub:        { fontSize: 12, fontWeight: "700", color: MUTED, marginTop: -2 },
  topRight:        { flexDirection: "row", alignItems: "center", gap: 10 },
  greetRow:        { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  bell:            { width: 44, height: 44, borderRadius: 22, backgroundColor: SURFACE, alignItems: "center", justifyContent: "center" },
  bellBadge:       { position: "absolute", top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: "#fff" },
  bellBadgeText:   { color: "#fff", fontSize: 9, fontWeight: "800" },
  greeting:        { color: MUTED, fontSize: 14 },
  name:            { color: INK, fontSize: 22, fontWeight: "800", marginTop: 2 },
  avatar:          { width: 46, height: 46, borderRadius: 23 },
  avatarFallback:  { backgroundColor: BLUE, alignItems: "center", justifyContent: "center" },
  avatarInitial:   { color: "#fff", fontWeight: "800", fontSize: 18 },

  actionsGrid:     { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 12 },
  actionSquare:    { width: "100%", backgroundColor: "#fff", borderRadius: 20, paddingVertical: 18, paddingHorizontal: 12, alignItems: "center", borderWidth: 1.5, borderColor: BLUE },
  actionImg:       { width: 76, height: 76, marginBottom: 6 },
  actionLabel:     { color: INK, fontSize: 15, fontWeight: "800" },
  actionDesc:      { color: MUTED, fontSize: 11.5, textAlign: "center", lineHeight: 15, marginTop: 3 },

  activeCard:      { marginHorizontal: 20, marginTop: 18, backgroundColor: BLUE, borderRadius: 18, padding: 16, overflow: "hidden" },
  activeCircle:    { position: "absolute", top: -30, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.12)" },
  activeRow:       { flexDirection: "row", alignItems: "center", gap: 12 },
  activeAvatar:    { width: 50, height: 50, borderRadius: 25 },
  activeAvatarFallback: { backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  activeAvatarInit:{ color: "#fff", fontWeight: "800", fontSize: 18 },
  activeLabel:     { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" },
  activeName:      { color: "#fff", fontSize: 16, fontWeight: "800", marginTop: 2 },
  progressTrack:   { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.25)", marginTop: 14 },
  progressFill:    { height: 6, borderRadius: 3, backgroundColor: "#fff" },
  activeCaption:   { color: "rgba(255,255,255,0.9)", fontSize: 13, marginTop: 10, fontWeight: "600" },

  sectionTitle:    { color: INK, fontSize: 18, fontWeight: "800", marginTop: 24, marginHorizontal: 20, marginBottom: 12 },
  sectionHead:     { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  link:            { color: BLUE, fontSize: 13, fontWeight: "700", marginRight: 20, marginBottom: 14 },

  catRow:          { paddingHorizontal: 20, gap: 16 },
  catItem:         { alignItems: "center", gap: 8, width: 72 },
  catTile:         { width: 56, height: 56, borderRadius: 16, backgroundColor: SURFACE, alignItems: "center", justifyContent: "center" },
  catLabel:        { color: INK, fontSize: 12, fontWeight: "600", textAlign: "center" },

  promo:           { flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginTop: 24, backgroundColor: "#FFF7E6", borderRadius: 16, padding: 18 },
  promoBig:        { color: "#B45309", fontSize: 26, fontWeight: "900" },
  promoTitle:      { color: "#92400E", fontSize: 15, fontWeight: "700", marginTop: 2 },
  promoSub:        { color: "#B45309", fontSize: 12, marginTop: 4 },

  proRow:          { paddingHorizontal: 20, gap: 12 },
  proCard:         { width: 160, borderWidth: 1, borderColor: LINE, borderRadius: 16, padding: 12 },
  proPhoto:        { width: "100%", height: 100, borderRadius: 12, backgroundColor: SURFACE },
  proPhotoFallback:{ alignItems: "center", justifyContent: "center" },
  proPhotoInit:    { color: BLUE, fontSize: 32, fontWeight: "800" },
  proName:         { color: INK, fontSize: 14, fontWeight: "800", marginTop: 10 },
  proTrade:        { color: MUTED, fontSize: 12, marginTop: 2 },
  proMetaRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  proRating:       { color: "#F59E0B", fontSize: 13, fontWeight: "700" },
  proRate:         { color: INK, fontSize: 13, fontWeight: "700" },

  actRow:          { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: LINE },
  actIcon:         { width: 40, height: 40, borderRadius: 12, backgroundColor: SURFACE, alignItems: "center", justifyContent: "center" },
  actTitle:        { color: INK, fontSize: 14, fontWeight: "700" },
  actMeta:         { color: MUTED, fontSize: 12, marginTop: 2 },
  actPrice:        { color: INK, fontSize: 14, fontWeight: "800" },
  actStatus:       { fontSize: 11, fontWeight: "700", marginTop: 2 },

  empty:           { alignItems: "center", paddingVertical: 24, gap: 12 },
  emptyText:       { color: MUTED, fontSize: 14 },
  emptyBtn:        { backgroundColor: BLUE, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 11 },
  emptyBtnText:    { color: "#fff", fontWeight: "800", fontSize: 14 },
});

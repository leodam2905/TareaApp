import { useState, useCallback, useMemo, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, Image, ActivityIndicator, RefreshControl, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Alert, Linking } from "react-native";
import { api } from "@/lib/api";

const BLUE = "#2563EB", INK = "#0F172A", MUTED = "#64748B", SURFACE = "#F1F5F9", LINE = "#E2E8F0";
const RADIUS_MI = 60;

// Miles between two lat/long points.
function milesBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 3958.8, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type Trust = { identityVerified: boolean; phoneVerified: boolean; backgroundChecked: boolean; licensed: boolean; insured: boolean; paymentVerified: boolean; topRated: boolean; topPro: boolean };
type Handyman = {
  id: string; name: string; avatarUrl: string | null; city: string | null; state: string | null;
  latitude: number | null; longitude: number | null;
  isVerified: boolean;
  handymanProfile: { bio: string | null; hourlyRate: number | null; rating: number | null; totalJobs: number; isPremium: boolean; yearsExperience: number } | null;
  services: { title: string; category: string }[];
  trust?: Trust;
};

const CATEGORIES: { label: string; value: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { label: "All",        value: "ALL",              icon: "grid-outline" },
  { label: "Plumbing",   value: "PLUMBING",         icon: "water-outline" },
  { label: "Electrical", value: "ELECTRICAL",       icon: "flash-outline" },
  { label: "Painting",   value: "PAINTING",         icon: "color-palette-outline" },
  { label: "Assembly",   value: "CARPENTRY",        icon: "construct-outline" },
  { label: "Cleaning",   value: "CLEANING",         icon: "sparkles-outline" },
  { label: "HVAC",       value: "HVAC",             icon: "thermometer-outline" },
  { label: "Landscaping",value: "LANDSCAPING",      icon: "leaf-outline" },
  { label: "Laundry",    value: "LAUNDRY",          icon: "shirt-outline" },
  { label: "Moving",     value: "MOVING",           icon: "cube-outline" },
  { label: "Appliance",  value: "APPLIANCE_REPAIR", icon: "build-outline" },
];
const SORTS = [{ key: "best", label: "Best match" }, { key: "rating", label: "Top rated" }, { key: "price", label: "Price: Low" }] as const;
type SortKey = typeof SORTS[number]["key"];

const prettyCat = (c: string) => c.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, m => m.toUpperCase());

const TRUST_DEFS: { key: keyof Trust; label: string; icon: React.ComponentProps<typeof Ionicons>["name"]; color: string }[] = [
  { key: "topPro",            label: "Top Pro",    icon: "trophy",            color: "#F59E0B" },
  { key: "topRated",          label: "Top Rated",  icon: "star",              color: "#F59E0B" },
  { key: "licensed",          label: "Licensed",   icon: "ribbon",            color: BLUE },
  { key: "insured",           label: "Insured",    icon: "shield-checkmark",  color: "#10B981" },
  { key: "backgroundChecked", label: "Verified",   icon: "shield-checkmark",  color: BLUE },
];

export default function BrowseScreen() {
  const router = useRouter();
  const [handymen, setHandymen] = useState<Handyman[]>([]);
  const [favIds, setFavIds]     = useState<Set<string>>(new Set());
  const [search, setSearch]     = useState("");
  const [cat, setCat]           = useState("ALL");
  const [sort, setSort]         = useState<SortKey>("best");
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [city, setCity]         = useState("Your area");
  const [nearMe, setNearMe]     = useState(false);
  const [coords, setCoords]     = useState<{ lat: number; lng: number } | null>(null);
  const [locBusy, setLocBusy]   = useState(false);

  // Acquire the device location, handling permission gracefully:
  //  - first ask → show a plain-language explainer, then the OS dialog
  //  - previously denied → guide the user to Settings (OS won't re-prompt)
  //  - success → set coords + resolve the current city
  const acquireLocation = async (auto = false): Promise<boolean> => {
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) {
      if (auto) return false; // don't surprise-prompt on open; wait for a tap
      const proceed = await new Promise<boolean>(resolve => {
        Alert.alert("Show pros near you",
          "Tarea uses your location to find trusted pros within about 60 miles. You can turn this off anytime.",
          [{ text: "Not now", style: "cancel", onPress: () => resolve(false) }, { text: "Continue", onPress: () => resolve(true) }]);
      });
      if (!proceed) return false;
      perm = await Location.requestForegroundPermissionsAsync();
    }
    if (!perm.granted) {
      if (!auto) Alert.alert("Location is off",
        "To see pros near you, turn on location for Tarea in Settings.",
        [{ text: "Not now", style: "cancel" }, { text: "Open Settings", onPress: () => Linking.openSettings() }]);
      return false;
    }
    try {
      const pos = await Location.getCurrentPositionAsync({});
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      const geo = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const g = geo[0]; if (g?.city) setCity(g.region ? `${g.city}, ${g.region}` : g.city);
      return true;
    } catch { return false; }
  };

  // On open, auto-enable the near-me filter only if permission is already granted
  // (never a surprise prompt). Otherwise show all pros; the toggle invites opt-in.
  useEffect(() => { (async () => { if (await acquireLocation(true)) setNearMe(true); })(); }, []);

  const load = async () => {
    try {
      const [hRes, pRes, fRes] = await Promise.all([api.get("/handyman/browse"), api.get("/profile"), api.get("/favorites")]);
      if (hRes.ok) setHandymen(await hRes.json());
      if (pRes.ok) { const p = await pRes.json(); if (p.city) setCity(p.state ? `${p.city}, ${p.state}` : p.city); }
      if (fRes.ok) { const favs = await fRes.json(); setFavIds(new Set(favs.map((f: any) => f?.handyman?.user?.id).filter(Boolean))); }
    } finally { setLoading(false); setRefreshing(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const toggleNearMe = async () => {
    if (nearMe) { setNearMe(false); return; }   // turn off
    if (coords) { setNearMe(true); return; }     // already have a fix
    setLocBusy(true);
    const ok = await acquireLocation(false);     // explainer + settings recovery
    setNearMe(ok);
    setLocBusy(false);
  };

  const toggleFav = async (id: string) => {
    const on = favIds.has(id);
    setFavIds(prev => { const n = new Set(prev); on ? n.delete(id) : n.add(id); return n; });
    try { on ? await api.delete(`/favorites/${id}`) : await api.post(`/favorites/${id}`, {}); }
    catch { setFavIds(prev => { const n = new Set(prev); on ? n.add(id) : n.delete(id); return n; }); }
  };

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = handymen.filter(h =>
      (cat === "ALL" || h.services.some(sv => sv.category === cat)) &&
      (!q || h.name.toLowerCase().includes(q) || h.services.some(sv => sv.title.toLowerCase().includes(q) || prettyCat(sv.category).toLowerCase().includes(q)))
    );
    // Within-60-miles filter: only pros with coordinates inside the radius.
    if (nearMe && coords) {
      r = r.filter(h => h.latitude != null && h.longitude != null && milesBetween(coords.lat, coords.lng, h.latitude, h.longitude) <= RADIUS_MI);
    }
    if (sort === "rating") r = [...r].sort((a, b) => (b.handymanProfile?.rating ?? 0) - (a.handymanProfile?.rating ?? 0));
    if (sort === "price")  r = [...r].sort((a, b) => (a.handymanProfile?.hourlyRate ?? 1e9) - (b.handymanProfile?.hourlyRate ?? 1e9));
    return r;
  }, [handymen, search, cat, sort, nearMe, coords]);

  const renderCard = ({ item: h }: { item: Handyman }) => {
    const hp = h.handymanProfile;
    const badges = h.trust ? TRUST_DEFS.filter(d => h.trust![d.key]).slice(0, 3) : [];
    const specialty = h.services[0] ? `${prettyCat(h.services[0].category)} Pro` : "Handyman";
    return (
      <View style={s.card}>
        <View style={s.photoWrap}>
          {h.avatarUrl ? <Image source={{ uri: h.avatarUrl }} style={s.photo} /> : <View style={[s.photo, s.photoFallback]}><Text style={s.photoInit}>{h.name[0]}</Text></View>}
          <View style={s.availBadge}><Text style={s.availText}>Available</Text></View>
        </View>

        <View style={{ flex: 1 }}>
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>{h.name}</Text>
            {h.isVerified && <Ionicons name="checkmark-circle" size={16} color={BLUE} />}
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => toggleFav(h.id)} hitSlop={8}>
              <Ionicons name={favIds.has(h.id) ? "heart" : "heart-outline"} size={20} color={favIds.has(h.id) ? "#EF4444" : "#CBD5E1"} />
            </TouchableOpacity>
          </View>
          <Text style={s.specialty}>{specialty}</Text>

          <View style={s.ratingRow}>
            <Ionicons name="star" size={13} color="#F59E0B" />
            <Text style={s.ratingText}>{hp?.rating != null ? hp.rating.toFixed(1) : "New"}</Text>
            <Text style={s.reviews}>({hp?.totalJobs ?? 0} reviews)</Text>
          </View>

          {hp?.yearsExperience ? (
            <View style={s.expRow}><Ionicons name="shield-checkmark" size={13} color={BLUE} /><Text style={s.expText}>{hp.yearsExperience}+ years experience</Text></View>
          ) : null}

          {badges.length > 0 && (
            <View style={s.badgeRow}>
              {badges.map(b => (
                <View key={b.key} style={s.badge}><Ionicons name={b.icon} size={11} color={b.color} /><Text style={[s.badgeText, { color: b.color }]}>{b.label}</Text></View>
              ))}
            </View>
          )}

          {hp?.bio ? <Text style={s.bio} numberOfLines={2}>{hp.bio}</Text> : null}

          <View style={s.tags}>
            {h.services.slice(0, 3).map(sv => <View key={sv.title} style={s.tag}><Text style={s.tagText}>{prettyCat(sv.category)}</Text></View>)}
          </View>

          <View style={s.cardFoot}>
            <View>
              {hp?.hourlyRate != null && <Text style={s.rate}>${hp.hourlyRate}<Text style={s.rateUnit}>/hr</Text></Text>}
              <Text style={s.minHr}>Min. 1 hour</Text>
            </View>
            <TouchableOpacity style={s.viewBtn} onPress={() => router.push({ pathname: "/(customer)/handyman-detail" as any, params: { userId: h.id } })}>
              <Text style={s.viewBtnText}>View Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} hitSlop={8}><Ionicons name="chevron-back" size={22} color={INK} /></TouchableOpacity>
        <Text style={s.hTitle}>Browse Pros</Text>
        <View style={s.loc}><Ionicons name="location-outline" size={15} color={MUTED} /><Text style={s.locText} numberOfLines={1}>{city}</Text></View>
      </View>

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow} style={{ flexGrow: 0 }}>
        {CATEGORIES.map(c => (
          <TouchableOpacity key={c.value} style={[s.catTile, cat === c.value && s.catTileOn]} onPress={() => setCat(c.value)}>
            <Ionicons name={c.icon} size={22} color={cat === c.value ? BLUE : "#475569"} />
            <Text style={[s.catLabel, cat === c.value && { color: BLUE }]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sort / filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow} style={{ flexGrow: 0 }}>
        <TouchableOpacity style={[s.pill, nearMe && s.pillBlue]} onPress={toggleNearMe} disabled={locBusy}>
          {locBusy ? <ActivityIndicator size="small" color={BLUE} /> : <Ionicons name="navigate" size={13} color={nearMe ? BLUE : MUTED} />}
          <Text style={[s.pillText, nearMe && { color: BLUE }]}>Within {RADIUS_MI} mi</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.pill} onPress={() => setSort(sort === "best" ? "rating" : sort === "rating" ? "price" : "best")}>
          <Text style={s.pillText}>Sort: {SORTS.find(x => x.key === sort)?.label}</Text><Ionicons name="chevron-down" size={13} color={MUTED} />
        </TouchableOpacity>
        <View style={[s.pill, s.pillOn]}><View style={s.dot} /><Text style={[s.pillText, { color: "#10B981" }]}>Available now</Text></View>
        <TouchableOpacity style={[s.pill, sort === "rating" && s.pillBlue]} onPress={() => setSort("rating")}><Text style={[s.pillText, sort === "rating" && { color: BLUE }]}>Top rated</Text></TouchableOpacity>
        <TouchableOpacity style={[s.pill, sort === "price" && s.pillBlue]} onPress={() => setSort("price")}><Text style={[s.pillText, sort === "price" && { color: BLUE }]}>Price</Text><Ionicons name="chevron-down" size={13} color={sort === "price" ? BLUE : MUTED} /></TouchableOpacity>
      </ScrollView>

      <View style={s.divider} />

      {loading ? (
        <View style={s.center}><ActivityIndicator color={BLUE} size="large" /></View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={h => h.id}
          renderItem={renderCard}
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 28 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={BLUE} />}
          ListEmptyComponent={<View style={s.center}><Text style={s.empty}>{nearMe ? `No pros within ${RADIUS_MI} miles. Tap "Within ${RADIUS_MI} mi" to turn off the filter.` : "No pros match your filters."}</Text></View>}
          ListFooterComponent={
            <View style={s.trustBanner}>
              <View style={s.trustIcon}><Ionicons name="shield-checkmark" size={20} color={BLUE} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.trustTitle}>Verified, trusted pros</Text>
                <Text style={s.trustSub}>We verify identity, experience and reviews so you can book with confidence.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={BLUE} />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: "#F6F8FC" },
  center:        { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 40 },
  empty:         { color: MUTED, fontSize: 15 },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
  iconBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: LINE },
  hTitle:        { color: INK, fontSize: 20, fontWeight: "900" },
  searchRow:     { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 14, height: 50, borderWidth: 1, borderColor: LINE },
  searchInput:   { flex: 1, color: INK, fontSize: 14 },
  loc:           { flexDirection: "row", alignItems: "center", gap: 3, maxWidth: 150, backgroundColor: SURFACE, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7 },
  locText:       { color: MUTED, fontSize: 12, fontWeight: "600" },
  catRow:        { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 8 },
  divider:       { height: 1, backgroundColor: LINE, marginTop: 2 },
  catTile:       { width: 70, height: 70, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: LINE, alignItems: "center", justifyContent: "center", gap: 5 },
  catTileOn:     { borderColor: BLUE, backgroundColor: "#EFF5FF", borderWidth: 1.5 },
  catLabel:      { color: "#475569", fontSize: 11, fontWeight: "600" },
  pillRow:       { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  pill:          { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 14, minHeight: 36, paddingVertical: 6, borderWidth: 1, borderColor: LINE },
  pillOn:        { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" },
  pillBlue:      { borderColor: BLUE, backgroundColor: "#EFF5FF" },
  pillText:      { color: "#475569", fontSize: 13, fontWeight: "600" },
  dot:           { width: 7, height: 7, borderRadius: 4, backgroundColor: "#10B981" },

  card:          { flexDirection: "row", gap: 12, backgroundColor: "#fff", borderRadius: 18, padding: 12, borderWidth: 1, borderColor: "#EEF2F7" },
  photoWrap:     { width: 96 },
  photo:         { width: 96, height: 116, borderRadius: 12, backgroundColor: SURFACE },
  photoFallback: { alignItems: "center", justifyContent: "center" },
  photoInit:     { color: BLUE, fontSize: 34, fontWeight: "800" },
  availBadge:    { position: "absolute", left: 6, bottom: 6, backgroundColor: "#16A34A", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  availText:     { color: "#fff", fontSize: 10, fontWeight: "800" },
  nameRow:       { flexDirection: "row", alignItems: "center", gap: 5 },
  name:          { color: INK, fontSize: 16, fontWeight: "800", maxWidth: "70%" },
  specialty:     { color: BLUE, fontSize: 13, fontWeight: "700", marginTop: 1 },
  ratingRow:     { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 5 },
  ratingText:    { color: INK, fontSize: 13, fontWeight: "800" },
  reviews:       { color: MUTED, fontSize: 12 },
  expRow:        { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
  expText:       { color: "#334155", fontSize: 12, fontWeight: "600" },
  badgeRow:      { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  badge:         { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: SURFACE, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText:     { fontSize: 10.5, fontWeight: "700" },
  bio:           { color: MUTED, fontSize: 12.5, lineHeight: 17, marginTop: 6 },
  tags:          { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tag:           { backgroundColor: SURFACE, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  tagText:       { color: "#475569", fontSize: 10.5, fontWeight: "600" },
  cardFoot:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  rate:          { color: INK, fontSize: 18, fontWeight: "900" },
  rateUnit:      { color: MUTED, fontSize: 12, fontWeight: "600" },
  minHr:         { color: MUTED, fontSize: 11, marginTop: 1 },
  viewBtn:       { backgroundColor: BLUE, borderRadius: 22, paddingHorizontal: 20, paddingVertical: 11 },
  viewBtnText:   { color: "#fff", fontSize: 14, fontWeight: "800" },

  trustBanner:   { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#EFF5FF", borderRadius: 16, padding: 16, marginTop: 4, borderWidth: 1, borderColor: "#DBE7FF" },
  trustIcon:     { width: 40, height: 40, borderRadius: 20, backgroundColor: "#DBE7FF", alignItems: "center", justifyContent: "center" },
  trustTitle:    { color: INK, fontSize: 14, fontWeight: "800" },
  trustSub:      { color: MUTED, fontSize: 12, lineHeight: 16, marginTop: 2 },
});

import { useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, Image, ActivityIndicator, RefreshControl, TouchableOpacity, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import MapView, { Marker, Callout } from "react-native-maps";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";

const { width } = Dimensions.get("window");

type Handyman = {
  id: string;
  name: string;
  avatarUrl: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  isVerified: boolean;
  handymanProfile: { bio: string | null; hourlyRate: number | null; rating: number | null; totalJobs: number; isPremium: boolean } | null;
  services: { title: string; category: string }[];
};

export default function BrowseScreen() {
  const router = useRouter();
  const [handymen,   setHandymen]   = useState<Handyman[]>([]);
  const [filtered,   setFiltered]   = useState<Handyman[]>([]);
  const [search,     setSearch]     = useState("");
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view,       setView]       = useState<"list" | "map">("list");
  const mapRef = useRef<MapView>(null);

  const load = async () => {
    try {
      const res = await api.get("/handyman/browse");
      if (res.ok) {
        const data: Handyman[] = await res.json();
        setHandymen(data);
        setFiltered(data);
      }
    } finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onSearch = (q: string) => {
    setSearch(q);
    const lq = q.toLowerCase();
    setFiltered(handymen.filter(h =>
      h.name.toLowerCase().includes(lq) ||
      h.services.some(sv => sv.title.toLowerCase().includes(lq) || sv.category.toLowerCase().includes(lq))
    ));
  };

  const withLocation = filtered.filter(h => h.latitude && h.longitude);

  const initialRegion = withLocation.length > 0 ? {
    latitude:      withLocation.reduce((s, h) => s + h.latitude!, 0) / withLocation.length,
    longitude:     withLocation.reduce((s, h) => s + h.longitude!, 0) / withLocation.length,
    latitudeDelta:  0.3,
    longitudeDelta: 0.3,
  } : { latitude: 34.0522, longitude: -118.2437, latitudeDelta: 0.5, longitudeDelta: 0.5 };

  const renderCard = ({ item: h }: { item: Handyman }) => (
    <TouchableOpacity style={s.card} onPress={() => router.push({ pathname: "/(customer)/handyman-detail" as any, params: { userId: h.id } })}>
      <View style={s.cardTop}>
        {h.avatarUrl
          ? <Image source={{ uri: h.avatarUrl }} style={s.avatar} />
          : <View style={[s.avatar, s.avatarFallback]}><Text style={s.avatarInitial}>{h.name[0]}</Text></View>}
        <View style={{ flex: 1 }}>
          <View style={s.nameRow}>
            <Text style={s.name}>{h.name}</Text>
            {h.isVerified && <Text style={s.verifiedBadge}>✓</Text>}
            {h.handymanProfile?.isPremium && <Text style={s.proBadge}>PRO</Text>}
          </View>
          {h.city ? <Text style={s.city}>{h.city}{h.state ? `, ${h.state}` : ""}</Text> : null}
          {h.handymanProfile?.rating != null && (
            <Text style={s.rating}>⭐ {h.handymanProfile.rating.toFixed(1)} · {h.handymanProfile.totalJobs} jobs</Text>
          )}
          {h.handymanProfile?.hourlyRate != null && (
            <Text style={s.rate}>${h.handymanProfile.hourlyRate}/hr</Text>
          )}
        </View>
      </View>
      {h.handymanProfile?.bio ? <Text style={s.bio} numberOfLines={2}>{h.handymanProfile.bio}</Text> : null}
      {h.services.length > 0 && (
        <View style={s.tags}>
          {h.services.slice(0, 3).map(sv => (
            <View key={sv.title} style={s.tag}>
              <Text style={s.tagText}>{sv.category.replace(/_/g, " ")}</Text>
            </View>
          ))}
          {h.services.length > 3 && <View style={s.tag}><Text style={s.tagText}>+{h.services.length - 3}</Text></View>}
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Browse Pros</Text>
        <View style={s.toggle}>
          <TouchableOpacity style={[s.toggleBtn, view === "list" && s.toggleActive]} onPress={() => setView("list")}>
            <Text style={[s.toggleText, view === "list" && s.toggleTextActive]}>≡ List</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.toggleBtn, view === "map" && s.toggleActive]} onPress={() => setView("map")}>
            <Text style={[s.toggleText, view === "map" && s.toggleTextActive]}>⊕ Map</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <TextInput style={s.search} value={search} onChangeText={onSearch}
          placeholder="Search by name or service…" placeholderTextColor={C.slate500} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.sky} size="large" /></View>
      ) : view === "map" ? (
        /* MAP VIEW */
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={{ width, flex: 1 }}
            initialRegion={initialRegion}
            showsUserLocation
            showsMyLocationButton
          >
            {withLocation.map(h => (
              <Marker
                key={h.id}
                coordinate={{ latitude: h.latitude!, longitude: h.longitude! }}
                pinColor={h.handymanProfile?.isPremium ? C.amber : C.sky}
              >
                <Callout tooltip>
                  <View style={s.callout}>
                    <Text style={s.calloutName}>{h.name}</Text>
                    {h.handymanProfile?.rating != null && (
                      <Text style={s.calloutSub}>⭐ {h.handymanProfile.rating.toFixed(1)} · ${h.handymanProfile.hourlyRate}/hr</Text>
                    )}
                    {h.services[0] && <Text style={s.calloutService}>{h.services[0].category.replace(/_/g, " ")}</Text>}
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>
          {withLocation.length === 0 && (
            <View style={s.mapEmpty}>
              <Text style={s.mapEmptyText}>No handymen with location data yet.</Text>
            </View>
          )}
        </View>
      ) : (
        /* LIST VIEW */
        filtered.length === 0
          ? <View style={s.center}><Text style={s.empty}>No handymen found.</Text></View>
          : <FlatList
              data={filtered}
              keyExtractor={h => h.id}
              renderItem={renderCard}
              contentContainerStyle={{ padding: 16, gap: 12 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.sky} />}
            />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: C.ink },
  center:           { flex: 1, alignItems: "center", justifyContent: "center" },
  header:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title:            { color: C.white, fontSize: 24, fontWeight: "800" },
  toggle:           { flexDirection: "row", backgroundColor: "#1E293B", borderRadius: 10, padding: 3, gap: 3 },
  toggleBtn:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  toggleActive:     { backgroundColor: C.sky },
  toggleText:       { color: C.slate400, fontSize: 13, fontWeight: "600" },
  toggleTextActive: { color: C.ink },
  searchWrap:       { paddingHorizontal: 16, paddingBottom: 8 },
  search:           { backgroundColor: "#1E293B", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: C.white, fontSize: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  card:             { backgroundColor: "#1E293B", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  cardTop:          { flexDirection: "row", gap: 12, marginBottom: 10 },
  avatar:           { width: 52, height: 52, borderRadius: 26 },
  avatarFallback:   { backgroundColor: C.sky + "33", alignItems: "center", justifyContent: "center" },
  avatarInitial:    { color: C.sky, fontSize: 20, fontWeight: "800" },
  nameRow:          { flexDirection: "row", alignItems: "center", gap: 6 },
  name:             { color: C.white, fontSize: 15, fontWeight: "800" },
  verifiedBadge:    { backgroundColor: C.emerald + "22", color: C.emerald, fontSize: 10, fontWeight: "700", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  proBadge:         { backgroundColor: C.amber + "22", color: C.amber, fontSize: 10, fontWeight: "700", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  city:             { color: C.slate500, fontSize: 11, marginTop: 2 },
  rating:           { color: C.amber, fontSize: 12, marginTop: 2 },
  rate:             { color: C.emerald, fontSize: 12, fontWeight: "700", marginTop: 2 },
  bio:              { color: C.slate400, fontSize: 13, marginBottom: 10 },
  tags:             { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag:              { backgroundColor: "rgba(56,189,248,0.1)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tagText:          { color: C.sky, fontSize: 11, fontWeight: "600" },
  empty:            { color: C.slate400, fontSize: 15 },
  callout:          { backgroundColor: C.ink, borderRadius: 10, padding: 10, minWidth: 140, borderWidth: 1, borderColor: "rgba(56,189,248,0.3)" },
  calloutName:      { color: C.white, fontWeight: "800", fontSize: 13 },
  calloutSub:       { color: C.slate400, fontSize: 11, marginTop: 3 },
  calloutService:   { color: C.sky, fontSize: 11, marginTop: 3, fontWeight: "600" },
  mapEmpty:         { position: "absolute", bottom: 30, alignSelf: "center", backgroundColor: C.ink, borderRadius: 12, padding: 12 },
  mapEmptyText:     { color: C.slate400, fontSize: 13 },
});

import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";

type Favorite = {
  id: string;
  handyman: {
    id: string;
    rating: number;
    totalJobs: number;
    hourlyRate: number;
    isPremium: boolean;
    bio: string;
    user: { id: string; name: string; avatarUrl: string | null; city: string | null; isVerified: boolean };
    services: { id: string; title: string; category: string; minPrice: number; maxPrice: number }[];
  };
};

export default function FavoritesScreen() {
  const router = useRouter();
  const [favorites,  setFavorites]  = useState<Favorite[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get("/favorites");
    if (res.ok) setFavorites(await res.json());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const removeFavorite = async (handymanUserId: string) => {
    await api.delete(`/favorites/${handymanUserId}`);
    setFavorites(prev => prev.filter(f => f.handyman.user.id !== handymanUserId));
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={C.sky} size="large" /></View>;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Favorites</Text>
        <Text style={s.sub}>{favorites.length} saved pro{favorites.length !== 1 ? "s" : ""}</Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.sky} />}
      >
        {favorites.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>❤️</Text>
            <Text style={s.emptyTitle}>No favorites yet</Text>
            <Text style={s.emptyText}>Browse handymen and save your favorites for quick access.</Text>
            <TouchableOpacity style={s.browseBtn} onPress={() => router.push("/(customer)/tabs/browse" as any)}>
              <Text style={s.browseBtnText}>Browse Pros →</Text>
            </TouchableOpacity>
          </View>
        ) : favorites.map(f => {
          const h = f.handyman;
          const u = h.user;
          return (
            <View key={f.id} style={s.card}>
              <View style={s.cardTop}>
                {u.avatarUrl
                  ? <Image source={{ uri: u.avatarUrl }} style={s.avatar} />
                  : <View style={s.avatarFallback}><Text style={s.avatarInitial}>{u.name[0]}</Text></View>
                }
                <View style={{ flex: 1 }}>
                  <View style={s.nameRow}>
                    <Text style={s.name}>{u.name}</Text>
                    {u.isVerified && <Text style={s.badge}>✓ Verified</Text>}
                    {h.isPremium && <Text style={s.proBadge}>PRO</Text>}
                  </View>
                  <Text style={s.city}>{u.city ?? "—"}</Text>
                  <View style={s.statsRow}>
                    <Text style={s.stat}>⭐ {h.rating.toFixed(1)}</Text>
                    <Text style={s.stat}>🔧 {h.totalJobs} jobs</Text>
                    <Text style={s.stat}>💰 ${h.hourlyRate}/hr</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => removeFavorite(u.id)} style={s.heartBtn}>
                  <Text style={{ fontSize: 22 }}>❤️</Text>
                </TouchableOpacity>
              </View>

              {h.services.length > 0 && (
                <View style={s.services}>
                  {h.services.map(sv => (
                    <View key={sv.id} style={s.serviceChip}>
                      <Text style={s.serviceText}>{sv.title}</Text>
                    </View>
                  ))}
                </View>
              )}

              {h.bio ? <Text style={s.bio} numberOfLines={2}>{h.bio}</Text> : null}
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.ink },
  center:        { flex: 1, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  header:        { padding: 24, paddingBottom: 8 },
  title:         { color: C.white, fontSize: 26, fontWeight: "900" },
  sub:           { color: C.slate400, fontSize: 13, marginTop: 2 },
  card:          { margin: 16, marginBottom: 0, backgroundColor: "#1E293B", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", gap: 10 },
  cardTop:       { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  avatar:        { width: 52, height: 52, borderRadius: 26 },
  avatarFallback:{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.sky, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: C.ink, fontSize: 20, fontWeight: "900" },
  nameRow:       { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  name:          { color: C.white, fontWeight: "800", fontSize: 15 },
  badge:         { backgroundColor: C.emerald + "22", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  proBadge:      { backgroundColor: C.amber + "22", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  city:          { color: C.slate400, fontSize: 12, marginTop: 2 },
  statsRow:      { flexDirection: "row", gap: 10, marginTop: 6 },
  stat:          { color: C.slate300, fontSize: 12 },
  heartBtn:      { padding: 4 },
  services:      { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  serviceChip:   { backgroundColor: "rgba(56,189,248,0.1)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(56,189,248,0.2)" },
  serviceText:   { color: C.sky, fontSize: 11, fontWeight: "600" },
  bio:           { color: C.slate400, fontSize: 13, lineHeight: 18 },
  empty:         { alignItems: "center", paddingTop: 80, gap: 12, paddingHorizontal: 32 },
  emptyEmoji:    { fontSize: 52 },
  emptyTitle:    { color: C.white, fontSize: 20, fontWeight: "800" },
  emptyText:     { color: C.slate400, fontSize: 14, textAlign: "center", lineHeight: 20 },
  browseBtn:     { backgroundColor: C.sky, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  browseBtnText: { color: C.ink, fontWeight: "800", fontSize: 14 },
});

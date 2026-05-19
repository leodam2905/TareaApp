import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, TextInput, Image } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { api } from "../../../constants/api";
import { colors, fontSize, radius, spacing } from "../../../constants/theme";

interface FavoriteEntry {
  handymanId: string;
}

const CATEGORIES = [
  { key: "PLUMBING", icon: "🔧", label: "Plumbing" },
  { key: "ELECTRICAL", icon: "⚡", label: "Electrical" },
  { key: "CARPENTRY", icon: "🪚", label: "Carpentry" },
  { key: "PAINTING", icon: "🎨", label: "Painting" },
  { key: "CLEANING", icon: "🧹", label: "Cleaning" },
  { key: "HVAC", icon: "❄️", label: "HVAC" },
  { key: "ROOFING", icon: "🏠", label: "Roofing" },
  { key: "LANDSCAPING", icon: "🌿", label: "Landscaping" },
  { key: "MOVING", icon: "📦", label: "Moving" },
  { key: "APPLIANCE_REPAIR", icon: "🔌", label: "Appliance" },
  { key: "GENERAL", icon: "🛠️", label: "General" },
];

interface Service {
  id: string; title: string; category: string; minPrice: number; maxPrice: number; description: string;
  handymanId: string | null;
  handyman: {
    id: string; isPremium: boolean; rating: number;
    user: { name: string; isVerified: boolean; latitude: number | null; longitude: number | null };
  } | null;
}

export default function BrowseScreen() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [filtered, setFiltered] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [togglingFav, setTogglingFav] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [cityName, setCityName] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [minPriceFilter, setMinPriceFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("");
  const [minRatingFilter, setMinRatingFilter] = useState(0);
  // Applied filter values
  const [appliedMinPrice, setAppliedMinPrice] = useState<number | null>(null);
  const [appliedMaxPrice, setAppliedMaxPrice] = useState<number | null>(null);
  const [appliedMinRating, setAppliedMinRating] = useState(0);

  const filtersActive = appliedMinPrice !== null || appliedMaxPrice !== null || appliedMinRating > 0;

  useEffect(() => {
    api.get("/services").then(r => {
      const data = r.data.filter((s: Service) => s !== null);
      setServices(data); setFiltered(data);
    }).finally(() => setLoading(false));

    api.get("/favorites").then(r => {
      const ids = new Set<string>((r.data as FavoriteEntry[]).map(f => f.handymanId));
      setFavoriteIds(ids);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (viewMode === "map" && !userCoords) {
      (async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") { setCityName("Unknown location"); return; }
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          setCityName(geo[0]?.city ?? geo[0]?.region ?? "your area");
        } catch {
          setCityName("your area");
        }
      })();
    }
  }, [viewMode, userCoords]);

  const toggleFavorite = async (handymanProfileId: string) => {
    if (!handymanProfileId || togglingFav === handymanProfileId) return;
    setTogglingFav(handymanProfileId);
    const isFav = favoriteIds.has(handymanProfileId);
    try {
      if (isFav) {
        await api.delete(`/favorites/${handymanProfileId}`);
        setFavoriteIds(prev => { const next = new Set(prev); next.delete(handymanProfileId); return next; });
      } else {
        await api.post(`/favorites/${handymanProfileId}`, {});
        setFavoriteIds(prev => new Set([...prev, handymanProfileId]));
      }
    } catch { /* ignore */ }
    setTogglingFav(null);
  };

  const applyFilters = () => {
    setAppliedMinPrice(minPriceFilter ? parseFloat(minPriceFilter) : null);
    setAppliedMaxPrice(maxPriceFilter ? parseFloat(maxPriceFilter) : null);
    setAppliedMinRating(minRatingFilter);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setMinPriceFilter(""); setMaxPriceFilter(""); setMinRatingFilter(0);
    setAppliedMinPrice(null); setAppliedMaxPrice(null); setAppliedMinRating(0);
    setShowFilters(false);
  };

  useEffect(() => {
    let result = services;
    if (selectedCat) result = result.filter(s => s.category === selectedCat);
    if (search.trim()) result = result.filter(s => s.title.toLowerCase().includes(search.toLowerCase()));
    if (appliedMaxPrice !== null) result = result.filter(s => s.minPrice <= appliedMaxPrice);
    if (appliedMinPrice !== null) result = result.filter(s => s.maxPrice >= appliedMinPrice);
    if (appliedMinRating > 0) result = result.filter(s => (s.handyman?.rating ?? 0) >= appliedMinRating);
    setFiltered(result);
  }, [selectedCat, search, services, appliedMinPrice, appliedMaxPrice, appliedMinRating]);

  const RATING_OPTIONS = [0, 3, 4, 4.5];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={styles.title}>Browse Services</Text>
          {/* List/Map toggle */}
          <View style={styles.viewToggle}>
            <Pressable
              style={[styles.toggleBtn, viewMode === "list" && styles.toggleBtnActive]}
              onPress={() => setViewMode("list")}
            >
              <Ionicons name="list" size={16} color={viewMode === "list" ? colors.ink : colors.inkSubtle} />
            </Pressable>
            <Pressable
              style={[styles.toggleBtn, viewMode === "map" && styles.toggleBtnActive]}
              onPress={() => setViewMode("map")}
            >
              <Ionicons name="map" size={16} color={viewMode === "map" ? colors.ink : colors.inkSubtle} />
            </Pressable>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={[styles.searchWrap, { flex: 1 }]}>
            <Ionicons name="search" size={16} color={colors.inkSubtle} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search services..."
              placeholderTextColor={colors.inkSubtle}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <Pressable
            style={[styles.filterBtn, filtersActive && styles.filterBtnActive]}
            onPress={() => setShowFilters(f => !f)}
          >
            <Ionicons name="options" size={18} color={filtersActive ? colors.ink : colors.inkSubtle} />
            {filtersActive && <View style={styles.filterDot} />}
          </Pressable>
        </View>
      </View>

      {/* Filter Panel */}
      {showFilters && (
        <View style={styles.filterPanel}>
          <Text style={styles.filterTitle}>Filters</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Min Price ($)</Text>
              <TextInput
                style={styles.filterInput}
                value={minPriceFilter}
                onChangeText={setMinPriceFilter}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.inkSubtle}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Max Price ($)</Text>
              <TextInput
                style={styles.filterInput}
                value={maxPriceFilter}
                onChangeText={setMaxPriceFilter}
                keyboardType="numeric"
                placeholder="Any"
                placeholderTextColor={colors.inkSubtle}
              />
            </View>
          </View>
          <Text style={[styles.filterLabel, { marginTop: spacing.sm }]}>Min Rating</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
            {RATING_OPTIONS.map(r => (
              <Pressable
                key={r}
                style={[styles.ratingChip, minRatingFilter === r && styles.ratingChipActive]}
                onPress={() => setMinRatingFilter(r)}
              >
                <Text style={[styles.ratingChipText, minRatingFilter === r && styles.ratingChipActiveText]}>
                  {r === 0 ? "Any" : `${r}★`}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
            <Pressable style={[styles.filterActionBtn, styles.filterClearBtn]} onPress={clearFilters}>
              <Text style={styles.filterClearText}>Clear</Text>
            </Pressable>
            <Pressable style={[styles.filterActionBtn, styles.filterApplyBtn]} onPress={applyFilters}>
              <Text style={styles.filterApplyText}>Apply</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.xl }}>
        <Pressable onPress={() => setSelectedCat(null)} style={[styles.chip, !selectedCat && styles.chipActive]}>
          <Text style={[styles.chipText, !selectedCat && styles.chipActiveText]}>All</Text>
        </Pressable>
        {CATEGORIES.map(c => (
          <Pressable key={c.key} onPress={() => setSelectedCat(selectedCat === c.key ? null : c.key)}
            style={[styles.chip, selectedCat === c.key && styles.chipActive]}>
            <Text style={[styles.chipText, selectedCat === c.key && styles.chipActiveText]}>{c.icon} {c.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Map view */}
      {viewMode === "map" && (
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map-outline" size={52} color={colors.inkSubtle} />
          <Text style={styles.mapTitle}>Map view coming soon</Text>
          <Text style={styles.mapSub}>Available in the full app build</Text>
        </View>
      )}

      {viewMode === "list" && loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.skyBlue} size="large" /></View>
      ) : viewMode === "list" ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          {filtered.map((s, i) => (
            <View key={s.id} entering={FadeInDown.delay(i * 40)}>
              <Pressable style={styles.card} onPress={() => router.push(`/service/${s.id}`)}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardCat}>{CATEGORIES.find(c => c.key === s.category)?.icon} {CATEGORIES.find(c => c.key === s.category)?.label}</Text>
                  <Text style={styles.cardTitle} numberOfLines={1}>{s.title}</Text>
                  {s.handyman && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={styles.cardMeta}>
                        {s.handyman.user.name}{s.handyman.user.isVerified ? " ✓" : ""}{s.handyman.isPremium ? " ⭐ PRO" : ""} · ⭐ {s.handyman.rating.toFixed(1)}
                      </Text>
                      <Pressable
                        onPress={() => s.handyman && toggleFavorite(s.handyman.id)}
                        hitSlop={8}
                        disabled={togglingFav === s.handyman?.id}
                      >
                        <Ionicons
                          name={favoriteIds.has(s.handyman.id) ? "heart" : "heart-outline"}
                          size={16}
                          color={favoriteIds.has(s.handyman.id) ? "#EF4444" : colors.inkSubtle}
                        />
                      </Pressable>
                    </View>
                  )}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.price}>${s.minPrice}–${s.maxPrice}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.inkSubtle} />
                </View>
              </Pressable>
            </View>
          ))}
          {filtered.length === 0 && (
            <Text style={styles.empty}>No services found.</Text>
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.sm },
  title: { fontSize: fontSize["2xl"], fontWeight: "800", color: colors.white },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 10, borderWidth: 1, borderColor: colors.cardBorder },
  searchInput: { flex: 1, color: colors.white, fontSize: fontSize.sm },
  chips: { flexGrow: 0, paddingVertical: spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  chipActive: { backgroundColor: colors.skyBlue, borderColor: colors.skyBlue },
  chipText: { color: colors.inkSubtle, fontSize: fontSize.xs, fontWeight: "600" },
  chipActiveText: { color: colors.ink },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  scroll: { padding: spacing.xl, gap: spacing.sm, paddingBottom: 100 },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.cardBorder },
  cardLeft: { flex: 1, gap: 3 },
  cardCat: { color: colors.inkSubtle, fontSize: fontSize.xs },
  cardTitle: { color: colors.white, fontWeight: "700", fontSize: fontSize.base },
  cardMeta: { color: colors.inkSubtle, fontSize: fontSize.xs },
  price: { color: colors.skyBlue, fontWeight: "800", fontSize: fontSize.sm, marginBottom: 4 },
  empty: { color: colors.inkSubtle, textAlign: "center", paddingTop: 60, fontSize: fontSize.base },
  viewToggle: { flexDirection: "row", backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.cardBorder, overflow: "hidden" },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  toggleBtnActive: { backgroundColor: colors.skyBlue },
  filterBtn: { padding: 10, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, alignItems: "center", justifyContent: "center", position: "relative" },
  filterBtnActive: { backgroundColor: colors.skyBlue, borderColor: colors.skyBlue },
  filterDot: { position: "absolute", top: 6, right: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger },
  filterPanel: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.cardBorder, padding: spacing.md, gap: spacing.sm },
  filterTitle: { color: colors.white, fontWeight: "700", fontSize: fontSize.sm },
  filterLabel: { color: "rgba(255,255,255,0.6)", fontSize: fontSize.xs, fontWeight: "600", marginBottom: 4 },
  filterInput: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: radius.md, borderWidth: 1, borderColor: colors.cardBorder, color: colors.white, paddingHorizontal: spacing.sm, paddingVertical: 8, fontSize: fontSize.sm },
  ratingChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.cardBorder },
  ratingChipActive: { backgroundColor: colors.skyBlue, borderColor: colors.skyBlue },
  ratingChipText: { color: colors.inkSubtle, fontSize: fontSize.xs, fontWeight: "600" },
  ratingChipActiveText: { color: colors.ink },
  filterActionBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.xl, alignItems: "center" },
  filterClearBtn: { borderWidth: 1, borderColor: colors.cardBorder },
  filterClearText: { color: colors.inkSubtle, fontWeight: "700", fontSize: fontSize.sm },
  filterApplyBtn: { backgroundColor: colors.skyBlue },
  filterApplyText: { color: colors.ink, fontWeight: "700", fontSize: fontSize.sm },
  mapPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  mapTitle: { color: colors.white, fontSize: fontSize.lg, fontWeight: "700" },
  mapSub: { color: colors.inkSubtle, fontSize: fontSize.sm },
  callout: { width: 180, padding: 8, gap: 3 },
  calloutTitle: { fontWeight: "700", fontSize: 13, color: "#0F172A" },
  calloutMeta: { fontSize: 11, color: "#64748B" },
  calloutPrice: { fontSize: 12, fontWeight: "700", color: "#0EA5E9" },
  calloutTap: { fontSize: 10, color: "#94A3B8", marginTop: 2 },
});

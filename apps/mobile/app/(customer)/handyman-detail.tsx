import { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";

type Service = { id: string; title: string; category: string; minPrice: number | null; maxPrice: number | null; duration: number | null };
type Profile = {
  id: string; name: string; avatarUrl: string | null; city: string | null; state: string | null;
  isVerified?: boolean;
  handymanProfile: {
    id: string; bio: string | null; rating: number | null; totalJobs: number;
    hourlyRate: number | null; yearsExperience: number | null;
    responseTime: string | null; backgroundCheckStatus: string;
    isPremium?: boolean;
    services: Service[];
  } | null;
};
type Review = { id: string; rating: number; comment: string | null; createdAt: string; author: { name: string; avatarUrl: string | null } };

export default function HandymanDetailScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [pRes, rRes] = await Promise.all([
        api.get(`/users/${userId}`),
        api.get(`/reviews/handyman/${userId}`),
      ]);
      if (pRes.ok) setProfile(await pRes.json());
      if (rRes.ok) setReviews(await rRes.json());
      setLoading(false);
    };
    load();
  }, [userId]);

  const toggleFav = async () => {
    if (favorited) {
      await api.delete(`/favorites/${userId}`);
    } else {
      await api.post("/favorites", { handymanId: userId });
    }
    setFavorited(f => !f);
  };

  const bookService = (service: Service) => {
    router.push({ pathname: "/(customer)/book" as any, params: { handymanId: userId, serviceId: service.id, serviceTitle: service.title, servicePrice: service.minPrice ?? 0 } });
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={C.sky} size="large" /></View>;
  if (!profile) return <View style={s.center}><Text style={s.empty}>Handyman not found.</Text></View>;

  const hp = profile.handymanProfile;
  const stars = "★".repeat(Math.round(hp?.rating ?? 0)) + "☆".repeat(5 - Math.round(hp?.rating ?? 0));

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Back + fav */}
        <View style={s.topBar}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.favBtn} onPress={toggleFav}>
            <Text style={{ fontSize: 22 }}>{favorited ? "❤️" : "🤍"}</Text>
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={s.hero}>
          {profile.avatarUrl
            ? <Image source={{ uri: profile.avatarUrl }} style={s.avatar} />
            : <View style={[s.avatar, s.avatarFallback]}><Text style={s.avatarInitial}>{profile.name[0]}</Text></View>}
          <Text style={s.name}>{profile.name}</Text>
          <View style={s.badgeRow}>
            {profile.isVerified && <View style={s.verifiedBadge}><Text style={s.verifiedText}>✓ Verified</Text></View>}
            {hp?.isPremium && <View style={s.proBadge}><Text style={s.proText}>PRO</Text></View>}
            {hp?.backgroundCheckStatus === "APPROVED" && <View style={s.bgBadge}><Text style={s.bgText}>✓ Background Checked</Text></View>}
          </View>
          {profile.city && <Text style={s.location}>📍 {profile.city}{profile.state ? `, ${profile.state}` : ""}</Text>}
          {hp?.rating != null && (
            <View style={s.ratingRow}>
              <Text style={s.stars}>{stars}</Text>
              <Text style={s.ratingNum}>{hp.rating.toFixed(1)} ({hp.totalJobs} jobs)</Text>
            </View>
          )}
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          {hp?.hourlyRate != null && <View style={s.stat}><Text style={s.statVal}>${hp.hourlyRate}/hr</Text><Text style={s.statLabel}>Rate</Text></View>}
          {hp?.yearsExperience != null && <View style={s.stat}><Text style={s.statVal}>{hp.yearsExperience}yr</Text><Text style={s.statLabel}>Experience</Text></View>}
          <View style={s.stat}><Text style={s.statVal}>{hp?.totalJobs ?? 0}</Text><Text style={s.statLabel}>Jobs Done</Text></View>
          {hp?.responseTime && <View style={s.stat}><Text style={s.statVal}>{hp.responseTime}</Text><Text style={s.statLabel}>Response</Text></View>}
        </View>

        {/* Bio */}
        {hp?.bio && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>About</Text>
            <Text style={s.bio}>{hp.bio}</Text>
          </View>
        )}

        {/* Services */}
        {hp?.services && hp.services.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Services</Text>
            {hp.services.map(sv => (
              <TouchableOpacity key={sv.id} style={s.serviceCard} onPress={() => bookService(sv)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.serviceTitle}>{sv.title}</Text>
                  <Text style={s.serviceCategory}>{sv.category.replace(/_/g, " ")}</Text>
                  {sv.duration && <Text style={s.serviceMeta}>⏱ ~{sv.duration} min</Text>}
                </View>
                <View style={s.serviceRight}>
                  {sv.minPrice != null && <Text style={s.servicePrice}>${sv.minPrice}{sv.maxPrice && sv.maxPrice !== sv.minPrice ? `–$${sv.maxPrice}` : ""}</Text>}
                  <Text style={s.bookNow}>Book →</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Reviews ({reviews.length})</Text>
            {reviews.slice(0, 5).map(r => (
              <View key={r.id} style={s.reviewCard}>
                <View style={s.reviewHeader}>
                  <View style={[s.reviewAvatar]}><Text style={s.reviewInitial}>{r.author.name[0]}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.reviewName}>{r.author.name}</Text>
                    <Text style={s.reviewStars}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</Text>
                  </View>
                  <Text style={s.reviewDate}>{new Date(r.createdAt).toLocaleDateString()}</Text>
                </View>
                {r.comment && <Text style={s.reviewComment}>{r.comment}</Text>}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Sticky book button */}
      {hp?.services && hp.services.length > 0 && (
        <View style={s.stickyBar}>
          <TouchableOpacity style={s.bookBtn} onPress={() => bookService(hp.services[0])}>
            <Text style={s.bookBtnText}>Book Now</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.ink },
  center:        { flex: 1, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  empty:         { color: C.slate400, fontSize: 15 },
  topBar:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  backBtn:       { padding: 8 },
  backText:      { color: C.sky, fontSize: 15, fontWeight: "600" },
  favBtn:        { padding: 8 },
  hero:          { alignItems: "center", paddingHorizontal: 24, paddingBottom: 16 },
  avatar:        { width: 96, height: 96, borderRadius: 48, marginBottom: 12 },
  avatarFallback:{ backgroundColor: "rgba(56,189,248,0.15)", alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: C.sky, fontSize: 36, fontWeight: "800" },
  name:          { color: C.white, fontSize: 24, fontWeight: "900", marginBottom: 8 },
  badgeRow:      { flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center", marginBottom: 8 },
  verifiedBadge: { backgroundColor: "rgba(16,185,129,0.15)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  verifiedText:  { color: C.emerald, fontSize: 11, fontWeight: "700" },
  proBadge:      { backgroundColor: "rgba(245,158,11,0.15)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  proText:       { color: C.amber, fontSize: 11, fontWeight: "700" },
  bgBadge:       { backgroundColor: "rgba(56,189,248,0.1)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  bgText:        { color: C.sky, fontSize: 11, fontWeight: "600" },
  location:      { color: C.slate400, fontSize: 13, marginBottom: 8 },
  ratingRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
  stars:         { color: C.amber, fontSize: 16 },
  ratingNum:     { color: C.slate400, fontSize: 13 },
  statsRow:      { flexDirection: "row", justifyContent: "space-around", marginHorizontal: 16, marginBottom: 8, backgroundColor: "#1E293B", borderRadius: 16, padding: 16 },
  stat:          { alignItems: "center" },
  statVal:       { color: C.sky, fontWeight: "800", fontSize: 15 },
  statLabel:     { color: C.slate500, fontSize: 11, marginTop: 2 },
  section:       { marginHorizontal: 16, marginTop: 16 },
  sectionTitle:  { color: C.white, fontSize: 17, fontWeight: "800", marginBottom: 10 },
  bio:           { color: C.slate400, fontSize: 14, lineHeight: 21 },
  serviceCard:   { backgroundColor: "#1E293B", borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  serviceTitle:  { color: C.white, fontWeight: "700", fontSize: 14 },
  serviceCategory:{ color: C.sky, fontSize: 11, marginTop: 2 },
  serviceMeta:   { color: C.slate500, fontSize: 11, marginTop: 2 },
  serviceRight:  { alignItems: "flex-end", gap: 4 },
  servicePrice:  { color: C.emerald, fontWeight: "800", fontSize: 14 },
  bookNow:       { color: C.sky, fontSize: 12, fontWeight: "700" },
  reviewCard:    { backgroundColor: "#1E293B", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  reviewHeader:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  reviewAvatar:  { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(56,189,248,0.15)", alignItems: "center", justifyContent: "center" },
  reviewInitial: { color: C.sky, fontWeight: "700", fontSize: 14 },
  reviewName:    { color: C.white, fontWeight: "600", fontSize: 13 },
  reviewStars:   { color: C.amber, fontSize: 12 },
  reviewDate:    { color: C.slate500, fontSize: 11 },
  reviewComment: { color: C.slate400, fontSize: 13, lineHeight: 19 },
  stickyBar:     { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: C.ink, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  bookBtn:       { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  bookBtnText:   { color: C.ink, fontWeight: "900", fontSize: 16 },
});

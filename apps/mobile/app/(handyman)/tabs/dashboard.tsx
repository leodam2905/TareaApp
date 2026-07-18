import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Image } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";
import { SafeAreaView } from "react-native-safe-area-context";

const BLUE = "#2563EB";

type Profile = { name: string; avatarUrl: string | null; handymanProfile: { rating: number; totalJobs: number } | null };
type Earnings = { totalEarnings: number; pendingEarnings: number; totalJobs: number };
type Booking = { id: string; scheduledAt: string; address: string; city: string; status: string; totalPrice: number; service: { title: string } | null };
type Review = { id: string; rating: number; comment: string | null; createdAt: string; author: { name: string; avatarUrl: string | null } };
type JobReq = { id: string; title: string; scheduledAt: string; budgetMin: number; budgetMax: number; category: string };
type Checklist = Record<string, boolean | string>;

const STEP_KEYS = ["ica", "profile", "services", "availability", "backgroundCheck", "stripe"];
const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

export default function HandymanDashboard() {
  const router = useRouter();
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [earn, setEarn]         = useState<Earnings | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews]   = useState<Review[]>([]);
  const [requests, setRequests] = useState<JobReq[]>([]);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [p, e, b, rv, rq, c] = await Promise.all([
      api.get("/profile"), api.get("/handyman/earnings"), api.get("/bookings?role=handyman"),
      api.get("/reviews/received"), api.get("/job-requests"), api.get("/handyman/checklist"),
    ]);
    if (p.ok)  setProfile(await p.json());
    if (e.ok)  setEarn(await e.json());
    if (b.ok)  setBookings(await b.json());
    if (rv.ok) setReviews(await rv.json());
    if (rq.ok) setRequests(await rq.json());
    if (c.ok)  setChecklist(await c.json());
    setLoading(false); setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={s.center}><ActivityIndicator color={BLUE} size="large" /></View>;

  const hp = profile?.handymanProfile;
  const now = new Date();
  const in7 = new Date(Date.now() + 7 * 864e5);
  const upcoming = bookings
    .filter(b => ["PENDING", "ACCEPTED", "IN_PROGRESS"].includes(b.status) && new Date(b.scheduledAt) >= new Date(now.toDateString()))
    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  const upcoming7 = upcoming.filter(b => new Date(b.scheduledAt) <= in7).length;
  const completed = bookings.filter(b => b.status === "COMPLETED").length || earn?.totalJobs || 0;
  const stepsDone = checklist ? STEP_KEYS.filter(k => checklist[k] === true).length : 0;
  const pct = Math.round((stepsDone / 6) * 100);

  const series = bookings.filter(b => b.status === "COMPLETED").slice(-8).map(b => b.totalPrice);
  const maxS = Math.max(1, ...series);

  const fmtDate = (d: string) => { const dt = new Date(d); return { m: MONTHS[dt.getMonth()], d: dt.getDate() }; };
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={BLUE} />}>

        {/* Top bar */}
        <View style={s.topbar}>
          <View style={s.brandRow}>
            <Image source={require("../../../assets/splash-logo.png")} style={s.logo} resizeMode="contain" />
            <View>
              <Text style={s.brand}>Tarea</Text>
              <Text style={s.brandSub}>Pro</Text>
            </View>
          </View>
          <View style={s.topRight}>
            <TouchableOpacity onPress={() => router.push("/(handyman)/tabs/notifications")} style={s.bellWrap}>
              <Ionicons name="notifications-outline" size={24} color={C.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/(handyman)/tabs/profile")}>
              {profile?.avatarUrl
                ? <Image source={{ uri: profile.avatarUrl }} style={s.avatar} />
                : <View style={s.avatarPh}><Text style={s.avatarInit}>{profile?.name?.[0]?.toUpperCase()}</Text></View>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Welcome */}
        <View style={s.pad}>
          <Text style={s.welcome}>Welcome back, {profile?.name?.split(" ")[0]}! 👋</Text>
          <Text style={s.welcomeSub}>Here's what's happening with your business today.</Text>
        </View>

        {/* Stat cards */}
        <View style={s.statsRow}>
          <Stat icon="briefcase-outline" tint="#EFF5FF" iconColor={BLUE} label="Total Earned" value={`$${(earn?.totalEarnings ?? 0).toFixed(0)}`} sub="All time" />
          <Stat icon="checkmark-done-outline" tint="#ECFDF3" iconColor="#16A34A" label="Completed" value={String(completed)} sub="Jobs done" />
        </View>
        <View style={s.statsRow}>
          <Stat icon="time-outline" tint="#FFF7ED" iconColor="#F59E0B" label="Upcoming" value={String(upcoming7)} sub="Next 7 days" />
          <Stat icon="star" tint="#F5F3FF" iconColor="#7C3AED" label="Rating" value={(hp?.rating ?? 0).toFixed(1)} sub={`(${reviews.length})`} star />
        </View>

        {/* Upcoming jobs */}
        <Card>
          <CardHeader title="Upcoming Jobs" onView={() => router.push("/(handyman)/tabs/jobs")} />
          {upcoming.length === 0
            ? <Text style={s.empty}>No upcoming jobs yet.</Text>
            : upcoming.slice(0, 4).map(b => {
                const dd = fmtDate(b.scheduledAt);
                const confirmed = b.status === "ACCEPTED" || b.status === "IN_PROGRESS";
                return (
                  <TouchableOpacity key={b.id} style={s.jobRow} onPress={() => router.push(`/(handyman)/job-detail?id=${b.id}` as any)}>
                    <View style={s.dateBadge}><Text style={s.dateM}>{dd.m}</Text><Text style={s.dateD}>{dd.d}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.jobTitle} numberOfLines={1}>{b.service?.title ?? "Job"}</Text>
                      <Text style={s.jobMeta} numberOfLines={1}>{fmtTime(b.scheduledAt)} · {b.city || b.address}</Text>
                    </View>
                    <View style={[s.pill, confirmed ? s.pillBlue : s.pillAmber]}>
                      <Text style={[s.pillText, { color: confirmed ? BLUE : "#B45309" }]}>{confirmed ? "Confirmed" : "Pending"}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
                  </TouchableOpacity>
                );
              })}
        </Card>

        {/* Earnings overview */}
        <Card>
          <Text style={s.cardTitle}>Earnings Overview</Text>
          <Text style={s.earnBig}>${(earn?.totalEarnings ?? 0).toFixed(0)}</Text>
          <Text style={s.earnSub}>${(earn?.pendingEarnings ?? 0).toFixed(0)} pending payout</Text>
          <View style={s.chart}>
            {series.length === 0
              ? <Text style={s.chartEmpty}>Your earnings trend appears here as you complete jobs.</Text>
              : series.map((v, i) => <View key={i} style={[s.bar, { height: 10 + (v / maxS) * 60 }]} />)}
          </View>
        </Card>

        {/* Profile completeness */}
        <TouchableOpacity onPress={() => router.push("/(handyman)/setup-checklist")}>
          <Card>
            <View style={s.pcRow}>
              <View style={[s.pcRing, { borderColor: pct >= 100 ? "#16A34A" : BLUE }]}>
                <Text style={[s.pcPct, { color: pct >= 100 ? "#16A34A" : BLUE }]}>{pct}%</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Profile Completeness</Text>
                <Text style={s.pcSub}>Complete your profile to get more job opportunities.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
            </View>
          </Card>
        </TouchableOpacity>

        {/* New job requests */}
        <Card>
          <CardHeader title="New Job Requests" onView={() => router.push("/(handyman)/tabs/find-jobs")} />
          {requests.length === 0
            ? <Text style={s.empty}>No new requests right now.</Text>
            : requests.slice(0, 3).map(r => (
                <TouchableOpacity key={r.id} style={s.reqRow} onPress={() => router.push("/(handyman)/tabs/find-jobs")}>
                  <View style={s.reqDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.reqTitle} numberOfLines={1}>{r.title}</Text>
                    <Text style={s.jobMeta}>{fmtTime(r.scheduledAt)} · {r.category?.replace(/_/g, " ").toLowerCase()}</Text>
                  </View>
                  <Text style={s.reqPrice}>${r.budgetMin}{r.budgetMax > r.budgetMin ? `–${r.budgetMax}` : ""}</Text>
                </TouchableOpacity>
              ))}
        </Card>

        {/* Recent reviews */}
        {reviews.length > 0 && (
          <Card>
            <CardHeader title="Recent Reviews" onView={() => router.push("/(handyman)/tabs/profile")} />
            {reviews.slice(0, 2).map(rv => (
              <View key={rv.id} style={s.reviewRow}>
                <View style={s.reviewTop}>
                  {rv.author.avatarUrl
                    ? <Image source={{ uri: rv.author.avatarUrl }} style={s.reviewAv} />
                    : <View style={s.reviewAv}><Text style={s.reviewInit}>{rv.author.name?.[0]?.toUpperCase()}</Text></View>}
                  <Text style={s.reviewName}>{rv.author.name}</Text>
                  <View style={s.stars}>{Array.from({ length: rv.rating }).map((_, i) => <Ionicons key={i} name="star" size={12} color="#F59E0B" />)}</View>
                </View>
                {rv.comment ? <Text style={s.reviewText} numberOfLines={2}>&ldquo;{rv.comment}&rdquo;</Text> : null}
              </View>
            ))}
          </Card>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ icon, tint, iconColor, label, value, sub, star }: any) {
  return (
    <View style={s.statCard}>
      <View style={[s.statIcon, { backgroundColor: tint }]}><Ionicons name={icon} size={20} color={iconColor} /></View>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}{star && <Text style={{ color: "#F59E0B" }}> ★</Text>}</Text>
      <Text style={s.statSub}>{sub}</Text>
    </View>
  );
}
function Card({ children }: any) { return <View style={s.card}>{children}</View>; }
function CardHeader({ title, onView }: { title: string; onView: () => void }) {
  return (
    <View style={s.cardHeader}>
      <Text style={s.cardTitle}>{title}</Text>
      <TouchableOpacity onPress={onView}><Text style={s.viewAll}>View all</Text></TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: "#F8FAFC" },
  center:      { flex: 1, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center" },
  pad:         { paddingHorizontal: 16, marginTop: 4, marginBottom: 12 },
  topbar:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.line },
  brandRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  logo:        { width: 34, height: 34 },
  brand:       { fontSize: 20, fontWeight: "900", color: BLUE, letterSpacing: -0.5, lineHeight: 22 },
  brandSub:    { fontSize: 12, fontWeight: "700", color: C.textMuted, marginTop: -2 },
  topRight:    { flexDirection: "row", alignItems: "center", gap: 14 },
  bellWrap:    { padding: 2 },
  avatar:      { width: 40, height: 40, borderRadius: 20 },
  avatarPh:    { width: 40, height: 40, borderRadius: 20, backgroundColor: "#EFF5FF", alignItems: "center", justifyContent: "center" },
  avatarInit:  { color: BLUE, fontWeight: "800", fontSize: 16 },

  welcome:     { fontSize: 24, fontWeight: "900", color: C.text, letterSpacing: -0.5 },
  welcomeSub:  { fontSize: 14, color: C.textMuted, marginTop: 4 },

  statsRow:    { flexDirection: "row", gap: 12, paddingHorizontal: 16, marginBottom: 12 },
  statCard:    { flex: 1, backgroundColor: C.bg, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.line },
  statIcon:    { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  statLabel:   { color: C.textMuted, fontSize: 13, fontWeight: "600" },
  statValue:   { color: C.text, fontSize: 24, fontWeight: "900", marginTop: 2 },
  statSub:     { color: C.textMuted, fontSize: 12, marginTop: 2 },

  card:        { backgroundColor: C.bg, borderRadius: 18, padding: 16, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: C.line },
  cardHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  cardTitle:   { fontSize: 17, fontWeight: "800", color: C.text },
  viewAll:     { color: BLUE, fontSize: 14, fontWeight: "700" },
  empty:       { color: C.textMuted, fontSize: 14, paddingVertical: 12, textAlign: "center" },

  jobRow:      { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line },
  dateBadge:   { width: 46, height: 46, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  dateM:       { color: BLUE, fontSize: 10, fontWeight: "800" },
  dateD:       { color: C.text, fontSize: 18, fontWeight: "900", marginTop: -2 },
  jobTitle:    { color: C.text, fontSize: 15, fontWeight: "700" },
  jobMeta:     { color: C.textMuted, fontSize: 12, marginTop: 2 },
  pill:        { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  pillBlue:    { backgroundColor: "#EFF5FF" },
  pillAmber:   { backgroundColor: "#FFF7ED" },
  pillText:    { fontSize: 12, fontWeight: "700" },

  earnBig:     { fontSize: 30, fontWeight: "900", color: C.text, marginTop: 6 },
  earnSub:     { color: "#16A34A", fontSize: 13, fontWeight: "600", marginTop: 2 },
  chart:       { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 74, marginTop: 14 },
  bar:         { flex: 1, backgroundColor: "#BFD3F5", borderRadius: 5 },
  chartEmpty:  { color: C.textMuted, fontSize: 13, alignSelf: "center", textAlign: "center", paddingHorizontal: 10 },

  pcRow:       { flexDirection: "row", alignItems: "center", gap: 14 },
  pcRing:      { width: 64, height: 64, borderRadius: 32, borderWidth: 5, alignItems: "center", justifyContent: "center" },
  pcPct:       { fontSize: 15, fontWeight: "900" },
  pcSub:       { color: C.textMuted, fontSize: 13, marginTop: 3, lineHeight: 18 },

  reqRow:      { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderTopWidth: 1, borderTopColor: C.line },
  reqDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: "#16A34A" },
  reqTitle:    { color: C.text, fontSize: 15, fontWeight: "700" },
  reqPrice:    { color: C.text, fontSize: 15, fontWeight: "800" },

  reviewRow:   { paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line },
  reviewTop:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  reviewAv:    { width: 30, height: 30, borderRadius: 15, backgroundColor: "#EFF5FF", alignItems: "center", justifyContent: "center" },
  reviewInit:  { color: BLUE, fontWeight: "800", fontSize: 13 },
  reviewName:  { color: C.text, fontSize: 14, fontWeight: "700", flex: 1 },
  stars:       { flexDirection: "row", gap: 1 },
  reviewText:  { color: C.textMuted, fontSize: 13, lineHeight: 18, fontStyle: "italic" },
});

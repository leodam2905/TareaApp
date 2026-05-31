import { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";

type Phase = { id: string; title: string; startedAt: string; confirmedAt: string | null };
type Booking = {
  id: string; status: string; scheduledAt: string; totalPrice: number; address: string; city: string;
  notes: string | null; isPaid: boolean; jobStartedAt: string | null; completedAt: string | null;
  service: { title: string; category: string };
  handyman: { id: string; name: string; avatarUrl: string | null; phone: string };
  customer: { id: string; name: string };
  review: { id: string; rating: number } | null;
  phases: Phase[];
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: C.amber, ACCEPTED: C.sky, IN_PROGRESS: C.orange, COMPLETED: C.emerald, CANCELLED: C.red,
};

function elapsed(from: string) {
  const secs = Math.floor((Date.now() - new Date(from).getTime()) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function CustomerBookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timer, setTimer] = useState("00:00:00");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get(`/bookings/${id}`);
    if (res.ok) setBooking(await res.json());
    setLoading(false);
    setRefreshing(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Live timer when IN_PROGRESS
  useEffect(() => {
    if (booking?.status !== "IN_PROGRESS" || !booking.jobStartedAt) return;
    setTimer(elapsed(booking.jobStartedAt));
    const iv = setInterval(() => setTimer(elapsed(booking.jobStartedAt!)), 1000);
    return () => clearInterval(iv);
  }, [booking?.status, booking?.jobStartedAt]);

  const cancel = () => {
    Alert.alert("Cancel Booking", "Are you sure? Cancellations within 24h of the appointment may incur a 50% fee.", [
      { text: "Keep Booking", style: "cancel" },
      {
        text: "Cancel", style: "destructive", onPress: async () => {
          setActing(true);
          await api.patch(`/bookings/${id}`, { status: "CANCELLED" });
          load();
          setActing(false);
        },
      },
    ]);
  };

  const confirmPhase = async (phaseId: string) => {
    setActing(true);
    await api.patch(`/bookings/${id}/phases/${phaseId}`, {});
    await load();
    setActing(false);
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={C.sky} size="large" /></View>;
  if (!booking) return <View style={s.center}><Text style={s.empty}>Booking not found.</Text></View>;

  const statusColor = STATUS_COLOR[booking.status] ?? C.slate400;
  const canReview = booking.status === "COMPLETED" && !booking.review;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.sky} />}>

        {/* Top bar */}
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← Back</Text></TouchableOpacity>
          <View style={[s.statusBadge, { backgroundColor: statusColor + "22" }]}>
            <Text style={[s.statusText, { color: statusColor }]}>{booking.status.replace("_", " ")}</Text>
          </View>
        </View>

        {/* Service */}
        <View style={s.card}>
          <Text style={s.serviceTitle}>{booking.service.title}</Text>
          <Text style={s.serviceCat}>{booking.service.category.replace(/_/g, " ")}</Text>
          <View style={s.divider} />
          <Row label="Handyman" value={booking.handyman.name} />
          <Row label="Date" value={new Date(booking.scheduledAt).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} />
          <Row label="Location" value={`${booking.address}, ${booking.city}`} />
          <Row label="Total" value={`$${booking.totalPrice.toFixed(2)}`} highlight />
          {!booking.isPaid && <Text style={s.payNotice}>💳 Payment pending after acceptance</Text>}
          {booking.notes && <><View style={s.divider} /><Text style={s.notes}>{booking.notes}</Text></>}
        </View>

        {/* Live timer */}
        {booking.status === "IN_PROGRESS" && booking.jobStartedAt && (
          <View style={s.timerCard}>
            <Text style={s.timerLabel}>Job in progress</Text>
            <Text style={s.timerValue}>{timer}</Text>
            <Text style={s.timerSub}>Started {new Date(booking.jobStartedAt).toLocaleTimeString()}</Text>
          </View>
        )}

        {/* Phases */}
        {booking.phases.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Work Phases</Text>
            {booking.phases.map(ph => (
              <View key={ph.id} style={s.phaseRow}>
                <View style={[s.phaseIcon, ph.confirmedAt ? s.phaseConfirmed : s.phasePending]}>
                  <Text style={s.phaseIconText}>{ph.confirmedAt ? "✓" : "○"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.phaseTitle}>{ph.title}</Text>
                  <Text style={s.phaseMeta}>Started {new Date(ph.startedAt).toLocaleTimeString()}</Text>
                  {ph.confirmedAt && <Text style={s.phaseMeta}>Confirmed {new Date(ph.confirmedAt).toLocaleTimeString()}</Text>}
                </View>
                {!ph.confirmedAt && booking.status === "IN_PROGRESS" && (
                  <TouchableOpacity style={s.confirmBtn} onPress={() => confirmPhase(ph.id)} disabled={acting}>
                    <Text style={s.confirmBtnText}>Confirm</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={s.actions}>
          {/* Chat */}
          {["ACCEPTED", "IN_PROGRESS"].includes(booking.status) && (
            <TouchableOpacity style={s.chatBtn} onPress={() => router.push({ pathname: "/(customer)/chat" as any, params: { bookingId: id, otherName: booking.handyman.name } })}>
              <Text style={s.chatBtnText}>💬 Message {booking.handyman.name}</Text>
            </TouchableOpacity>
          )}

          {/* Review & Tip */}
          {canReview && (
            <TouchableOpacity style={s.reviewBtn} onPress={() => router.push({ pathname: "/(customer)/review" as any, params: { bookingId: id, handymanId: booking.handyman.id, handymanName: booking.handyman.name } })}>
              <Text style={s.reviewBtnText}>⭐ Leave a Review</Text>
            </TouchableOpacity>
          )}
          {booking.status === "COMPLETED" && booking.review && (
            <View style={s.reviewedBadge}><Text style={s.reviewedText}>✓ Review submitted · {"★".repeat(booking.review.rating)}</Text></View>
          )}

          {/* Cancel */}
          {["PENDING", "ACCEPTED"].includes(booking.status) && (
            <TouchableOpacity style={s.cancelBtn} onPress={cancel} disabled={acting}>
              <Text style={s.cancelBtnText}>Cancel Booking</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 }}>
      <Text style={{ color: C.slate400, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: highlight ? C.emerald : C.white, fontSize: 13, fontWeight: highlight ? "800" : "600", maxWidth: "60%", textAlign: "right" }}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.ink },
  center:        { flex: 1, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  empty:         { color: C.slate400 },
  topBar:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 8 },
  back:          { color: C.sky, fontSize: 15, fontWeight: "600" },
  statusBadge:   { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:    { fontSize: 12, fontWeight: "700" },
  card:          { margin: 16, backgroundColor: "#1E293B", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  serviceTitle:  { color: C.white, fontSize: 18, fontWeight: "900", marginBottom: 2 },
  serviceCat:    { color: C.sky, fontSize: 12, marginBottom: 12 },
  divider:       { height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginVertical: 10 },
  payNotice:     { color: C.amber, fontSize: 12, marginTop: 8 },
  notes:         { color: C.slate400, fontSize: 13, lineHeight: 19 },
  timerCard:     { margin: 16, backgroundColor: "#1E2D1A", borderRadius: 16, padding: 20, alignItems: "center", borderWidth: 1, borderColor: "rgba(16,185,129,0.3)" },
  timerLabel:    { color: C.emerald, fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 8 },
  timerValue:    { color: C.white, fontSize: 48, fontWeight: "900", letterSpacing: 4, fontVariant: ["tabular-nums"] },
  timerSub:      { color: C.slate500, fontSize: 12, marginTop: 6 },
  section:       { marginHorizontal: 16, marginTop: 8 },
  sectionTitle:  { color: C.white, fontSize: 15, fontWeight: "800", marginBottom: 10 },
  phaseRow:      { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  phaseIcon:     { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  phasePending:  { backgroundColor: "rgba(245,158,11,0.2)" },
  phaseConfirmed:{ backgroundColor: "rgba(16,185,129,0.2)" },
  phaseIconText: { color: C.white, fontSize: 14, fontWeight: "700" },
  phaseTitle:    { color: C.white, fontWeight: "600", fontSize: 14 },
  phaseMeta:     { color: C.slate500, fontSize: 11, marginTop: 1 },
  confirmBtn:    { backgroundColor: C.emerald + "22", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.emerald + "44" },
  confirmBtnText:{ color: C.emerald, fontWeight: "700", fontSize: 12 },
  actions:       { margin: 16, gap: 10 },
  chatBtn:       { backgroundColor: "rgba(56,189,248,0.1)", borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(56,189,248,0.25)" },
  chatBtnText:   { color: C.sky, fontWeight: "700", fontSize: 15 },
  reviewBtn:     { backgroundColor: "rgba(245,158,11,0.1)", borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(245,158,11,0.25)" },
  reviewBtnText: { color: C.amber, fontWeight: "700", fontSize: 15 },
  reviewedBadge: { backgroundColor: "rgba(16,185,129,0.1)", borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(16,185,129,0.2)" },
  reviewedText:  { color: C.emerald, fontWeight: "600", fontSize: 14 },
  cancelBtn:     { backgroundColor: "rgba(239,68,68,0.08)", borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  cancelBtnText: { color: C.red, fontWeight: "700", fontSize: 15 },
});

import { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";

type Phase = { id: string; title: string; startedAt: string; confirmedAt: string | null };
type Booking = {
  id: string; status: string; scheduledAt: string; totalPrice: number;
  address: string; city: string; notes: string | null; isPaid: boolean;
  jobStartedAt: string | null; completedAt: string | null;
  service: { title: string; category: string };
  customer: { id: string; name: string; avatarUrl: string | null; phone: string };
  handyman: { id: string; name: string };
  review: { rating: number } | null;
  phases: Phase[];
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: C.amber, ACCEPTED: C.sky, IN_PROGRESS: C.orange, COMPLETED: C.emerald, CANCELLED: C.red,
};

function fmtTime(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking]     = useState<Booking | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing]       = useState(false);
  const [elapsed, setElapsed]     = useState(0);
  const [phaseTitle, setPhaseTitle] = useState("");
  const [addingPhase, setAddingPhase] = useState(false);
  const [showPhaseInput, setShowPhaseInput] = useState(false);
  const [onMyWay, setOnMyWay]     = useState(false);
  const [sendingLocation, setSendingLocation] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const res = await api.get(`/bookings/${id}`);
    if (res.ok) {
      const b: Booking = await res.json();
      setBooking(b);
      if (b.status === "IN_PROGRESS" && b.jobStartedAt) {
        const secs = Math.floor((Date.now() - new Date(b.jobStartedAt).getTime()) / 1000);
        setElapsed(secs > 0 ? secs : 0);
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Timer tick
  useEffect(() => {
    if (booking?.status === "IN_PROGRESS") {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [booking?.status]);

  // Stop location sharing when job starts or ends
  useEffect(() => {
    if (!booking) return;
    if (!["ACCEPTED"].includes(booking.status)) {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
      setOnMyWay(false);
    }
    return () => { if (locationIntervalRef.current) clearInterval(locationIntervalRef.current); };
  }, [booking?.status]);

  const markOnMyWay = async () => {
    setSendingLocation(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Location permission is required to share your position with the customer.");
      setSendingLocation(false);
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    await api.patch(`/bookings/${id}/location`, {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      isOnMyWay: true,
    });
    setOnMyWay(true);
    setSendingLocation(false);
    // Send location updates every 20 seconds
    locationIntervalRef.current = setInterval(async () => {
      try {
        const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await api.patch(`/bookings/${id}/location`, { lat: l.coords.latitude, lng: l.coords.longitude });
      } catch { /* ignore */ }
    }, 20000);
  };

  const patch = async (status: string) => {
    setActing(true);
    const res = await api.patch(`/bookings/${id}`, { status });
    if (res.ok) await load();
    else {
      const b = await res.json();
      Alert.alert("Error", b.error || "Could not update job");
    }
    setActing(false);
  };

  const accept  = () => patch("ACCEPTED");
  const decline = () => Alert.alert("Decline Job", "Decline this booking?", [
    { text: "Keep", style: "cancel" },
    { text: "Decline", style: "destructive", onPress: () => patch("CANCELLED") },
  ]);
  const startJob = () => Alert.alert("Start Job", "Mark this job as started? The timer will begin.", [
    { text: "Cancel", style: "cancel" },
    { text: "Start", onPress: () => patch("IN_PROGRESS") },
  ]);
  const complete = () => Alert.alert("Complete Job", "Mark this job as completed?", [
    { text: "Not Yet", style: "cancel" },
    { text: "Complete", onPress: () => patch("COMPLETED") },
  ]);

  const addPhase = async () => {
    if (!phaseTitle.trim()) return;
    setAddingPhase(true);
    const res = await api.post(`/bookings/${id}/phases`, { title: phaseTitle.trim() });
    if (res.ok) { setPhaseTitle(""); setShowPhaseInput(false); await load(); }
    else {
      const b = await res.json();
      Alert.alert("Error", b.error || "Could not add phase");
    }
    setAddingPhase(false);
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={C.sky} size="large" /></View>;
  if (!booking) return <View style={s.center}><Text style={s.empty}>Job not found.</Text></View>;

  const statusColor = STATUS_COLOR[booking.status] ?? C.slate400;
  const isPending   = booking.status === "PENDING";
  const isAccepted  = booking.status === "ACCEPTED";
  const isInProgress = booking.status === "IN_PROGRESS";
  const isDone      = ["COMPLETED", "CANCELLED"].includes(booking.status);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.sky} />}>

        {/* Top bar */}
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← Back</Text></TouchableOpacity>
          <View style={[s.statusBadge, { backgroundColor: statusColor + "22" }]}>
            <Text style={[s.statusText, { color: statusColor }]}>{booking.status.replace("_", " ")}</Text>
          </View>
        </View>

        {/* Job info */}
        <View style={s.card}>
          <Text style={s.serviceTitle}>{booking.service.title}</Text>
          <Text style={s.serviceCat}>{booking.service.category.replace(/_/g, " ")}</Text>
          <View style={s.divider} />
          <Row label="Customer" value={booking.customer.name} />
          <Row label="Phone" value={booking.customer.phone} />
          <Row label="Date" value={new Date(booking.scheduledAt).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} />
          <Row label="Location" value={`${booking.address}, ${booking.city}`} />
          <Row label="Your Earnings" value={`$${(booking.totalPrice * 0.9).toFixed(2)}`} highlight />
          {!booking.isPaid && <Text style={s.unpaid}>⚠️ Customer payment pending</Text>}
          {booking.notes && <><View style={s.divider} /><Text style={s.notes}>📝 {booking.notes}</Text></>}
        </View>

        {/* Timer card */}
        {isInProgress && booking.jobStartedAt && (
          <View style={s.timerCard}>
            <Text style={s.timerLabel}>⏱ JOB TIMER</Text>
            <Text style={s.timerValue}>{fmtTime(elapsed)}</Text>
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
                  {ph.confirmedAt
                    ? <Text style={[s.phaseMeta, { color: C.emerald }]}>✓ Customer confirmed</Text>
                    : <Text style={[s.phaseMeta, { color: C.amber }]}>Awaiting customer confirmation</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Add phase */}
        {isInProgress && (
          <View style={s.section}>
            {showPhaseInput ? (
              <View style={s.phaseForm}>
                <TextInput
                  style={s.phaseInput}
                  value={phaseTitle}
                  onChangeText={setPhaseTitle}
                  placeholder="Phase name (e.g. Electrical rough-in)"
                  placeholderTextColor={C.slate500}
                  autoFocus
                />
                <View style={s.phaseFormBtns}>
                  <TouchableOpacity style={s.phaseCancelBtn} onPress={() => { setShowPhaseInput(false); setPhaseTitle(""); }}>
                    <Text style={s.phaseCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.phaseAddBtn, addingPhase && s.btnDisabled]} onPress={addPhase} disabled={addingPhase}>
                    <Text style={s.phaseAddText}>{addingPhase ? "Adding…" : "Add Phase"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={s.addPhaseBtn} onPress={() => setShowPhaseInput(true)}>
                <Text style={s.addPhaseBtnText}>+ Add Work Phase</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Action buttons */}
        <View style={s.actions}>
          {/* Pending: accept / decline */}
          {isPending && (
            <View style={s.row2}>
              <TouchableOpacity style={[s.declineBtn, s.halfBtn, acting && s.btnDisabled]} onPress={decline} disabled={acting}>
                <Text style={s.declineBtnText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.acceptBtn, s.halfBtn, acting && s.btnDisabled]} onPress={accept} disabled={acting}>
                <Text style={s.acceptBtnText}>{acting ? "…" : "Accept Job"}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Accepted: on my way + start */}
          {isAccepted && (
            <>
              {!onMyWay && (
                <TouchableOpacity style={[s.onMyWayBtn, sendingLocation && s.btnDisabled]} onPress={markOnMyWay} disabled={sendingLocation}>
                  <Text style={s.onMyWayBtnText}>{sendingLocation ? "Getting location…" : "🚗 I'm On My Way"}</Text>
                </TouchableOpacity>
              )}
              {onMyWay && (
                <View style={s.onMyWayActive}>
                  <Text style={s.onMyWayActiveText}>📍 Sharing live location with customer</Text>
                </View>
              )}
              <TouchableOpacity style={[s.startBtn, acting && s.btnDisabled]} onPress={startJob} disabled={acting}>
                <Text style={s.startBtnText}>▶ Start Job</Text>
              </TouchableOpacity>
            </>
          )}

          {/* In progress: complete */}
          {isInProgress && (
            <TouchableOpacity style={[s.completeBtn, acting && s.btnDisabled]} onPress={complete} disabled={acting}>
              <Text style={s.completeBtnText}>✓ Mark as Complete</Text>
            </TouchableOpacity>
          )}

          {/* Chat */}
          {!isDone && (
            <TouchableOpacity style={s.chatBtn} onPress={() => router.push({ pathname: "/(handyman)/chat" as any, params: { bookingId: id, otherName: booking.customer.name } })}>
              <Text style={s.chatBtnText}>💬 Message {booking.customer.name}</Text>
            </TouchableOpacity>
          )}

          {/* Completed summary */}
          {booking.status === "COMPLETED" && (
            <View style={s.completedCard}>
              <Text style={s.completedLabel}>Job Completed</Text>
              {booking.completedAt && <Text style={s.completedMeta}>Finished at {new Date(booking.completedAt).toLocaleTimeString()}</Text>}
              <Text style={s.completedEarnings}>Earnings: ${(booking.totalPrice * 0.9).toFixed(2)}</Text>
              {booking.review && <Text style={s.reviewStars}>Customer rated: {"★".repeat(booking.review.rating)}</Text>}
            </View>
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
      <Text style={{ color: highlight ? C.emerald : C.white, fontSize: 13, fontWeight: highlight ? "800" : "600", maxWidth: "65%", textAlign: "right" }}>{value}</Text>
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
  unpaid:        { color: C.amber, fontSize: 12, marginTop: 8 },
  notes:         { color: C.slate400, fontSize: 13, lineHeight: 19 },
  timerCard:     { margin: 16, backgroundColor: "#1A1D10", borderRadius: 16, padding: 20, alignItems: "center", borderWidth: 2, borderColor: C.orange + "55" },
  timerLabel:    { color: C.orange, fontSize: 11, fontWeight: "800", letterSpacing: 2, marginBottom: 8 },
  timerValue:    { color: C.white, fontSize: 52, fontWeight: "900", letterSpacing: 4, fontVariant: ["tabular-nums"] },
  timerSub:      { color: C.slate500, fontSize: 12, marginTop: 6 },
  section:       { marginHorizontal: 16, marginTop: 8 },
  sectionTitle:  { color: C.white, fontSize: 15, fontWeight: "800", marginBottom: 10 },
  phaseRow:      { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  phaseIcon:     { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 2 },
  phasePending:  { backgroundColor: "rgba(245,158,11,0.2)" },
  phaseConfirmed:{ backgroundColor: "rgba(16,185,129,0.2)" },
  phaseIconText: { color: C.white, fontSize: 13, fontWeight: "700" },
  phaseTitle:    { color: C.white, fontWeight: "600", fontSize: 14 },
  phaseMeta:     { color: C.slate500, fontSize: 11, marginTop: 2 },
  phaseForm:     { backgroundColor: "#1E293B", borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  phaseInput:    { color: C.white, fontSize: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.15)", paddingBottom: 8 },
  phaseFormBtns: { flexDirection: "row", gap: 8 },
  phaseCancelBtn:{ flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  phaseCancelText:{ color: C.slate400, fontWeight: "600" },
  phaseAddBtn:   { flex: 2, paddingVertical: 10, alignItems: "center", borderRadius: 10, backgroundColor: C.sky },
  phaseAddText:  { color: C.ink, fontWeight: "800", fontSize: 14 },
  addPhaseBtn:   { borderWidth: 1, borderColor: "rgba(56,189,248,0.25)", borderRadius: 12, paddingVertical: 12, alignItems: "center", borderStyle: "dashed" },
  addPhaseBtnText:{ color: C.sky, fontWeight: "700", fontSize: 14 },
  actions:       { margin: 16, gap: 10 },
  row2:          { flexDirection: "row", gap: 10 },
  halfBtn:       { flex: 1 },
  declineBtn:    { backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 14, paddingVertical: 15, alignItems: "center", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)" },
  declineBtnText:{ color: C.red, fontWeight: "700", fontSize: 15 },
  acceptBtn:     { backgroundColor: C.emerald, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  acceptBtnText: { color: C.white, fontWeight: "900", fontSize: 15 },
  onMyWayBtn:      { backgroundColor: "rgba(56,189,248,0.15)", borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(56,189,248,0.4)" },
  onMyWayBtnText:  { color: C.sky, fontWeight: "800", fontSize: 15 },
  onMyWayActive:   { backgroundColor: "rgba(16,185,129,0.1)", borderRadius: 14, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(16,185,129,0.3)" },
  onMyWayActiveText: { color: C.emerald, fontWeight: "700", fontSize: 14 },
  startBtn:      { backgroundColor: C.orange, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  startBtnText:  { color: C.white, fontWeight: "900", fontSize: 16 },
  completeBtn:   { backgroundColor: C.emerald, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  completeBtnText:{ color: C.white, fontWeight: "900", fontSize: 16 },
  chatBtn:       { backgroundColor: "rgba(56,189,248,0.1)", borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(56,189,248,0.25)" },
  chatBtnText:   { color: C.sky, fontWeight: "700", fontSize: 15 },
  completedCard: { backgroundColor: "rgba(16,185,129,0.08)", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "rgba(16,185,129,0.2)", gap: 4 },
  completedLabel:{ color: C.emerald, fontWeight: "800", fontSize: 16 },
  completedMeta: { color: C.slate400, fontSize: 13 },
  completedEarnings:{ color: C.emerald, fontWeight: "800", fontSize: 18, marginTop: 4 },
  reviewStars:   { color: C.amber, fontSize: 14, marginTop: 4 },
  btnDisabled:   { opacity: 0.5 },
});

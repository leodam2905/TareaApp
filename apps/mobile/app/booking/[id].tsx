import { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, FlatList,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";
import { api, API_BASE } from "../../constants/api";
import * as SecureStore from "expo-secure-store";
import { colors, fontSize, radius, spacing } from "../../constants/theme";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#F59E0B", ACCEPTED: "#38BDF8", IN_PROGRESS: "#38BDF8",
  COMPLETED: "#10B981", CANCELLED: "#EF4444", DISPUTED: "#EF4444",
};

const CATEGORY_ICONS: Record<string, string> = {
  PLUMBING: "🔧", ELECTRICAL: "⚡", CARPENTRY: "🪚", PAINTING: "🎨",
  CLEANING: "🧹", HVAC: "❄️", ROOFING: "🏠", LANDSCAPING: "🌿",
  MOVING: "📦", APPLIANCE_REPAIR: "🔌", GENERAL: "🛠️",
};

type Message = {
  id: string; content: string; createdAt: string;
  sender: { id: string; name: string; role: string };
};

type Phase = { id: string; title: string; startedAt: string; confirmedAt: string | null };

type Booking = {
  id: string; status: string; scheduledAt: string; address: string;
  city: string; notes: string | null; totalPrice: number;
  isPaid: boolean; cancelReason: string | null; isOnMyWay: boolean;
  service: { title: string; category: string };
  customer: { id: string; name: string };
  handyman: { id: string; name: string; phone: string | null };
  review: { rating: number } | null;
  phases: Phase[];
  messages: Message[];
};

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [paying, setPaying] = useState(false);
  const [acting, setActing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [reviewPrompted, setReviewPrompted] = useState(false);
  const [onMyWay, setOnMyWay] = useState(false);
  const [handymanCoords, setHandymanCoords] = useState<{ lat: number; lng: number } | null>(null);
  const locationWatcher = useRef<Location.LocationSubscription | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/bookings/${id}`);
      setBooking(res.data);
      setMessages(res.data.messages ?? []);
    } catch {
      Alert.alert("Error", "Could not load booking");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    Promise.all([
      load(),
      api.get("/auth/me").then(r => {
        setCurrentUserId(r.data?.id ?? "");
        setCurrentUserRole(r.data?.role ?? "");
      }).catch(() => {}),
    ]);
  }, [load]);

  // Poll handyman location for customer when isOnMyWay
  useEffect(() => {
    if (!booking || currentUserRole !== "CUSTOMER" || !booking.isOnMyWay) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/bookings/${id}/location`);
        if (res.data.lat && res.data.lng) {
          setHandymanCoords({ lat: res.data.lat, lng: res.data.lng });
        }
      } catch { /* ignore */ }
    }, 10000);
    return () => clearInterval(interval);
  }, [booking, currentUserRole, id]);

  // Stop broadcasting location when component unmounts
  useEffect(() => {
    return () => { locationWatcher.current?.remove(); };
  }, []);

  // Auto-prompt customer to review after completion
  useEffect(() => {
    if (booking && !reviewPrompted && booking.status === "COMPLETED" && !booking.review && currentUserRole === "CUSTOMER") {
      setReviewPrompted(true);
      setTimeout(() => {
        Alert.alert(
          "Rate your experience",
          `How did ${booking.handyman.name} do? Leaving a review helps other customers.`,
          [
            { text: "Rate now", onPress: () => router.push(`/customer/bookings/${id}/review` as never) },
            { text: "Later", style: "cancel" },
          ]
        );
      }, 800);
    }
  }, [booking, currentUserRole, reviewPrompted, id, router]);

  const sendMessage = async () => {
    if (!msgText.trim()) return;
    setSending(true);
    try {
      const res = await api.post(`/bookings/${id}/messages`, { content: msgText.trim() });
      setMessages(prev => [...prev, res.data]);
      setMsgText("");
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch { Alert.alert("Error", "Failed to send message"); }
    setSending(false);
  };

  const confirmPhase = async (phaseId: string, title: string) => {
    try {
      await api.patch(`/bookings/${id}/phases/${phaseId}`);
      setBooking(prev => prev ? {
        ...prev,
        phases: prev.phases.map(p => p.id === phaseId ? { ...p, confirmedAt: new Date().toISOString() } : p),
      } : prev);
      Alert.alert("Confirmed!", `"${title}" marked as done.`);
    } catch { Alert.alert("Error", "Could not confirm phase"); }
  };

  const cancelBooking = () => {
    const hoursUntil = booking
      ? (new Date(booking.scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60)
      : Infinity;
    const isLate = booking?.isPaid && hoursUntil < 24;

    Alert.alert(
      "Cancel Booking",
      `Are you sure you want to cancel?${isLate ? "\n\n⚠️ Less than 24h before your booking — a 50% cancellation fee applies." : ""}`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Cancel Booking", style: "destructive",
          onPress: async () => {
            setActing(true);
            try {
              await api.patch(`/bookings/${id}`, { status: "CANCELLED" });
              setBooking(prev => prev ? { ...prev, status: "CANCELLED" } : prev);
            } catch { Alert.alert("Error", "Could not cancel"); }
            setActing(false);
          },
        },
      ]
    );
  };

  const fileDispute = () => {
    Alert.prompt(
      "File a Dispute",
      "Describe the issue with this booking:",
      async (reason) => {
        if (!reason?.trim()) return;
        try {
          await api.post(`/bookings/${id}/dispute`, { reason: reason.trim() });
          setBooking(prev => prev ? { ...prev, status: "DISPUTED" } : prev);
          Alert.alert("Dispute filed", "Our team will review and contact both parties.");
        } catch (e: unknown) {
          Alert.alert("Error", (e as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to file dispute");
        }
      },
      "plain-text"
    );
  };

  const startPayment = async () => {
    setPaying(true);
    try {
      const token = await SecureStore.getItemAsync("tarea_token");
      const res = await fetch(`${API_BASE}/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const result = await WebBrowser.openBrowserAsync(data.url);
      // After browser closes, reload booking to check isPaid
      if (result.type === "dismiss" || result.type === "cancel") {
        await load();
      }
    } catch (e: unknown) {
      Alert.alert("Payment failed", e instanceof Error ? e.message : "Please try again.");
    }
    setPaying(false);
  };

  const sendTip = async (tipAmount: number) => {
    try {
      const res = await api.post("/stripe/tip", { bookingId: id, tipAmount });
      if (res.data?.url) {
        await WebBrowser.openBrowserAsync(res.data.url);
      }
    } catch (e: unknown) {
      Alert.alert("Error", (e as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to process tip");
    }
  };

  const goOnMyWay = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { Alert.alert("Location required", "Enable location to share your position."); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await api.patch(`/bookings/${id}/location`, { lat: loc.coords.latitude, lng: loc.coords.longitude, isOnMyWay: true });
      setOnMyWay(true);
      setBooking(prev => prev ? { ...prev, isOnMyWay: true } : prev);
      // Broadcast live location every 30s
      locationWatcher.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 30000, distanceInterval: 50 },
        async position => {
          await api.patch(`/bookings/${id}/location`, {
            lat: position.coords.latitude, lng: position.coords.longitude,
          }).catch(() => {});
        }
      );
      Alert.alert("On my way!", "The customer has been notified and can see your live location.");
    } catch { Alert.alert("Error", "Could not share location"); }
  };

  const formatTime = (d: string) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formatDate = (d: string) => new Date(d).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.skyBlue} size="large" /></View>;
  if (!booking) return null;

  const isActive = ["PENDING", "ACCEPTED", "IN_PROGRESS"].includes(booking.status);
  const canCancel = ["PENDING", "ACCEPTED"].includes(booking.status);
  const pendingPhases = booking.phases.filter(p => !p.confirmedAt);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.topTitle} numberOfLines={1}>{booking.service.title}</Text>
            <Text style={styles.topSub}>#{booking.id.slice(-8).toUpperCase()}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[booking.status] ?? "#64748B") + "30" }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[booking.status] ?? "#64748B" }]}>
              {booking.status.replace("_", " ")}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* On my way */}
          {booking.isOnMyWay && isActive && (
            <View style={styles.onWayBanner}>
              <Text style={styles.onWayText}>🚗 Your handyman is on the way!</Text>
            </View>
          )}

          {/* Info card */}
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.catIcon}>{CATEGORY_ICONS[booking.service.category] || "🛠️"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceTitle}>{booking.service.title}</Text>
                <Text style={styles.subText}>{booking.service.category.replace("_", " ")}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.price}>${(booking.totalPrice * 1.10).toFixed(2)}</Text>
                <Text style={styles.feeBreakdown}>${booking.totalPrice.toFixed(2)} + 10% fee</Text>
                <Text style={[styles.paidLabel, { color: booking.isPaid ? colors.success : colors.warning }]}>
                  {booking.isPaid ? "✓ Paid" : "Unpaid"}
                </Text>
              </View>
            </View>
            <View style={styles.detailsGrid}>
              <Text style={styles.detailText}>📅 {formatDate(booking.scheduledAt)}</Text>
              <Text style={styles.detailText}>📍 {booking.city}</Text>
              <Text style={styles.detailText} numberOfLines={1}>🏠 {booking.address}</Text>
              {booking.notes && <Text style={styles.notes}>📝 {booking.notes}</Text>}
            </View>
          </View>

          {/* Handyman live location map — customer view */}
          {currentUserRole === "CUSTOMER" && booking.isOnMyWay && handymanCoords && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Handyman Location (live)</Text>
              <MapView
                style={{ height: 180, borderRadius: radius.lg, marginTop: 6 }}
                initialRegion={{
                  latitude: handymanCoords.lat,
                  longitude: handymanCoords.lng,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                }}
                region={{ latitude: handymanCoords.lat, longitude: handymanCoords.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
                scrollEnabled={false}
              >
                <Marker coordinate={{ latitude: handymanCoords.lat, longitude: handymanCoords.lng }} title={booking.handyman.name} />
              </MapView>
            </View>
          )}

          {/* On My Way button — handyman view */}
          {currentUserRole === "HANDYMAN" && booking.status === "ACCEPTED" && !onMyWay && !booking.isOnMyWay && (
            <Pressable style={styles.onWayBtn} onPress={goOnMyWay}>
              <Ionicons name="navigate" size={18} color={colors.white} />
              <Text style={styles.onWayBtnText}>I'm On My Way</Text>
            </Pressable>
          )}
          {currentUserRole === "HANDYMAN" && (onMyWay || booking.isOnMyWay) && (
            <View style={styles.onWayActive}>
              <Ionicons name="navigate" size={16} color={colors.success} />
              <Text style={[styles.onWayBtnText, { color: colors.success }]}>Sharing live location with customer</Text>
            </View>
          )}

          {/* Handyman */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Handyman</Text>
            <View style={styles.cardRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{booking.handyman.name[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.handyName}>{booking.handyman.name}</Text>
                {booking.handyman.phone && <Text style={styles.subText}>📞 {booking.handyman.phone}</Text>}
              </View>
              {booking.review && (
                <Text style={styles.rating}>⭐ {booking.review.rating}/5</Text>
              )}
            </View>
          </View>

          {/* Pay Now */}
          {booking.status === "ACCEPTED" && !booking.isPaid && (
            <Pressable style={[styles.payBtn, paying && { opacity: 0.7 }]} onPress={startPayment} disabled={paying}>
              {paying ? <ActivityIndicator color={colors.ink} size="small" /> : <Ionicons name="card" size={20} color={colors.ink} />}
              <Text style={styles.payBtnText}>
                {paying ? "Opening payment…" : `Pay $${(booking.totalPrice * 1.10).toFixed(2)} to Confirm`}
              </Text>
            </Pressable>
          )}

          {/* Phases */}
          {booking.phases.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>
                Job Phases · {booking.phases.filter(p => p.confirmedAt).length}/{booking.phases.length} confirmed
              </Text>
              {booking.phases.map(p => (
                <View key={p.id} style={[styles.phaseRow, { borderLeftColor: p.confirmedAt ? colors.success : colors.warning }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.phaseTitle, { color: p.confirmedAt ? colors.success : colors.white }]}>{p.title}</Text>
                    <Text style={styles.phaseTime}>
                      Started {formatTime(p.startedAt)}{p.confirmedAt ? ` · Confirmed ${formatTime(p.confirmedAt)}` : ""}
                    </Text>
                  </View>
                  {!p.confirmedAt && (
                    <Pressable style={styles.confirmBtn} onPress={() => confirmPhase(p.id, p.title)}>
                      <Text style={styles.confirmBtnText}>Confirm</Text>
                    </Pressable>
                  )}
                </View>
              ))}
              {pendingPhases.length > 0 && (
                <Text style={styles.phaseHint}>{pendingPhases.length} phase{pendingPhases.length > 1 ? "s" : ""} awaiting your confirmation</Text>
              )}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {canCancel && (
              <Pressable style={[styles.cancelBtn, acting && { opacity: 0.6 }]} onPress={cancelBooking} disabled={acting}>
                <Ionicons name="close-circle" size={16} color={colors.danger} />
                <Text style={styles.cancelBtnText}>Cancel Booking</Text>
              </Pressable>
            )}
            {["IN_PROGRESS", "COMPLETED"].includes(booking.status) && (
              <Pressable style={styles.disputeBtn} onPress={fileDispute}>
                <Ionicons name="alert-circle" size={16} color="#F59E0B" />
                <Text style={styles.disputeBtnText}>File Dispute</Text>
              </Pressable>
            )}
            {booking.status === "COMPLETED" && !booking.review && (
              <Pressable
                style={styles.reviewBtn}
                onPress={() => router.push(`/customer/bookings/${id}/review` as never)}
              >
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text style={styles.reviewBtnText}>Leave a Review</Text>
              </Pressable>
            )}
          </View>

          {/* Leave a Tip */}
          {booking.status === "COMPLETED" && booking.isPaid && (
            <Pressable
              style={styles.tipBtn}
              onPress={() => {
                const t10 = (booking.totalPrice * 0.10).toFixed(2);
                const t15 = (booking.totalPrice * 0.15).toFixed(2);
                const t20 = (booking.totalPrice * 0.20).toFixed(2);

                Alert.alert(
                  "Leave a Tip",
                  `Show your appreciation for great service!`,
                  [
                    { text: `10% ($${t10})`, onPress: () => sendTip(parseFloat(t10)) },
                    { text: `15% ($${t15})`, onPress: () => sendTip(parseFloat(t15)) },
                    { text: `20% ($${t20})`, onPress: () => sendTip(parseFloat(t20)) },
                    {
                      text: "Custom amount",
                      onPress: () =>
                        Alert.prompt("Custom Tip", "Enter tip amount ($):",
                          (val) => { const n = parseFloat(val); if (!isNaN(n) && n > 0) sendTip(n); },
                          "plain-text", "", "numeric"
                        ),
                    },
                    { text: "No thanks", style: "cancel" },
                  ]
                );
              }}
            >
              <Ionicons name="gift" size={16} color="#F59E0B" />
              <Text style={styles.tipBtnText}>Leave a Tip</Text>
            </Pressable>
          )}

          {/* Book Again */}
          {booking.status === "COMPLETED" && (
            <Pressable
              style={styles.bookAgainBtn}
              onPress={() => {
                Alert.prompt(
                  "Book Again",
                  "Enter the new date and time (e.g. 2026-05-15T10:00):",
                  async (dateInput) => {
                    if (!dateInput?.trim()) return;
                    const scheduledAt = new Date(dateInput.trim()).toISOString();
                    if (isNaN(new Date(scheduledAt).getTime())) {
                      Alert.alert("Invalid date", "Please enter a valid date/time.");
                      return;
                    }
                    try {
                      const res = await api.post(`/bookings/${id}/repeat`, { scheduledAt });
                      Alert.alert("Booked!", "Your repeat booking has been sent.", [
                        { text: "View", onPress: () => router.push(`/booking/${res.data.id}` as never) },
                        { text: "OK" },
                      ]);
                    } catch (e: unknown) {
                      Alert.alert("Error", (e as { response?: { data?: { error?: string } } }).response?.data?.error || "Failed to repeat booking");
                    }
                  },
                  "plain-text"
                );
              }}
            >
              <Ionicons name="refresh" size={16} color={colors.ink} />
              <Text style={styles.bookAgainBtnText}>Book Again</Text>
            </Pressable>
          )}

          {/* Messages */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Messages</Text>
            {messages.length === 0 ? (
              <Text style={styles.emptyMsg}>No messages yet. Start the conversation!</Text>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={m => m.id}
                scrollEnabled={false}
                contentContainerStyle={{ gap: 8 }}
                renderItem={({ item: m }) => {
                  const isMine = m.sender.id === currentUserId;
                  return (
                    <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
                      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                        <Text style={[styles.bubbleText, isMine && { color: colors.ink }]}>{m.content}</Text>
                      </View>
                      <Text style={styles.msgTime}>{formatTime(m.createdAt)}</Text>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </ScrollView>

        {/* Message input — only for active bookings */}
        {!["CANCELLED", "DISPUTED", "COMPLETED"].includes(booking.status) && (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.msgInput}
              value={msgText}
              onChangeText={setMsgText}
              placeholder="Type a message…"
              placeholderTextColor={colors.inkSubtle}
              multiline
              onSubmitEditing={sendMessage}
            />
            <Pressable style={[styles.sendBtn, (!msgText.trim() || sending) && { opacity: 0.5 }]} onPress={sendMessage} disabled={!msgText.trim() || sending}>
              {sending ? <ActivityIndicator size="small" color={colors.ink} /> : <Ionicons name="send" size={18} color={colors.ink} />}
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  topBar: { flexDirection: "row", alignItems: "center", paddingTop: 56, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.cardBorder, gap: spacing.sm },
  backBtn: { padding: 4 },
  topTitle: { color: colors.white, fontWeight: "800", fontSize: fontSize.base },
  topSub: { color: colors.inkSubtle, fontSize: fontSize.xs, marginTop: 2 },
  statusBadge: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: "700" },
  scroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: 120 },
  onWayBanner: { backgroundColor: colors.success + "15", borderWidth: 1, borderColor: colors.success + "40", borderRadius: radius.xl, padding: spacing.md },
  onWayText: { color: colors.success, fontWeight: "700", fontSize: fontSize.sm },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.cardBorder },
  cardRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  catIcon: { fontSize: 28 },
  serviceTitle: { color: colors.white, fontWeight: "700", fontSize: fontSize.base },
  subText: { color: colors.inkSubtle, fontSize: fontSize.xs, marginTop: 2 },
  price: { color: colors.skyBlue, fontWeight: "800", fontSize: fontSize.lg },
  paidLabel: { fontSize: fontSize.xs, fontWeight: "700", marginTop: 2 },
  feeBreakdown: { fontSize: fontSize.xs, color: colors.inkSubtle, marginTop: 1 },
  detailsGrid: { gap: 4, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.cardBorder },
  detailText: { color: colors.inkSubtle, fontSize: fontSize.sm },
  notes: { color: colors.inkSubtle, fontSize: fontSize.sm, fontStyle: "italic" },
  sectionLabel: { color: "rgba(255,255,255,0.5)", fontSize: fontSize.xs, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.skyBlue + "30", alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.skyBlue, fontWeight: "800", fontSize: fontSize.base },
  handyName: { color: colors.white, fontWeight: "700", fontSize: fontSize.sm },
  rating: { color: "#F59E0B", fontWeight: "700", fontSize: fontSize.sm },
  payBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.skyBlue, borderRadius: radius.xl, paddingVertical: 16 },
  payBtnText: { color: colors.ink, fontWeight: "800", fontSize: fontSize.base },
  phaseRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderLeftWidth: 3, paddingLeft: spacing.sm, paddingVertical: 6 },
  phaseTitle: { fontWeight: "600", fontSize: fontSize.sm },
  phaseTime: { color: colors.inkSubtle, fontSize: fontSize.xs, marginTop: 2 },
  phaseHint: { color: colors.warning, fontSize: fontSize.xs, fontWeight: "600", marginTop: 4 },
  confirmBtn: { backgroundColor: colors.warning, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 6 },
  confirmBtnText: { color: colors.ink, fontWeight: "700", fontSize: fontSize.xs },
  actions: { flexDirection: "row", gap: spacing.sm },
  cancelBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: colors.danger + "40", borderRadius: radius.xl, paddingVertical: 12 },
  cancelBtnText: { color: colors.danger, fontWeight: "700", fontSize: fontSize.sm },
  disputeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: "#F59E0B40", borderRadius: radius.xl, paddingVertical: 12 },
  disputeBtnText: { color: "#F59E0B", fontWeight: "700", fontSize: fontSize.sm },
  reviewBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#F59E0B20", borderWidth: 1, borderColor: "#F59E0B40", borderRadius: radius.xl, paddingVertical: 12 },
  reviewBtnText: { color: "#F59E0B", fontWeight: "700", fontSize: fontSize.sm },
  emptyMsg: { color: colors.inkSubtle, fontSize: fontSize.sm, textAlign: "center", paddingVertical: spacing.md },
  msgRow: { alignItems: "flex-start" },
  msgRowMine: { alignItems: "flex-end" },
  bubble: { maxWidth: "78%", borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: colors.skyBlue, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: "rgba(255,255,255,0.1)", borderBottomLeftRadius: 4 },
  bubbleText: { color: colors.white, fontSize: fontSize.sm },
  msgTime: { color: colors.inkSubtle, fontSize: 10, marginTop: 2, marginHorizontal: 4 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.cardBorder },
  msgInput: { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.white, fontSize: fontSize.base, maxHeight: 100, borderWidth: 1, borderColor: colors.cardBorder },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.skyBlue, alignItems: "center", justifyContent: "center" },
  bookAgainBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.skyBlue, borderRadius: radius.xl, paddingVertical: 14 },
  bookAgainBtnText: { color: colors.ink, fontWeight: "800", fontSize: fontSize.base },
  tipBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderWidth: 1, borderColor: "#F59E0B40", backgroundColor: "#F59E0B10", borderRadius: radius.xl, paddingVertical: 14 },
  tipBtnText: { color: "#F59E0B", fontWeight: "700", fontSize: fontSize.base },
  onWayBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: "#1E3A8A", borderRadius: radius.xl, paddingVertical: 14, borderWidth: 1, borderColor: colors.skyBlue + "40" },
  onWayBtnText: { color: colors.white, fontWeight: "700", fontSize: fontSize.base },
  onWayActive: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: 12 },
});

import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import GooglePlacesAutocomplete from "react-native-google-places-autocomplete";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";

export default function BookScreen() {
  const { handymanId, serviceId, serviceTitle, servicePrice } = useLocalSearchParams<{
    handymanId: string; serviceId: string; serviceTitle: string; servicePrice: string;
  }>();
  const router = useRouter();

  const [scheduledAt, setScheduledAt] = useState(new Date(Date.now() + 24 * 3600_000));
  const [showPicker, setShowPicker]   = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [address, setAddress]         = useState("");
  const [city, setCity]               = useState("");
  const [notes, setNotes]             = useState("");
  const [loading, setLoading]         = useState(false);

  const price = Number(servicePrice) || 0;

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
    " at " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const submit = async () => {
    if (!address.trim()) { Alert.alert("Error", "Address is required"); return; }
    if (!city.trim()) { Alert.alert("Error", "City is required"); return; }
    if (scheduledAt < new Date()) { Alert.alert("Error", "Please choose a future date"); return; }

    setLoading(true);
    try {
      const res = await api.post("/bookings", {
        serviceId,
        handymanUserId: handymanId,
        scheduledAt: scheduledAt.toISOString(),
        address: address.trim(),
        city: city.trim(),
        notes: notes.trim() || undefined,
        totalPrice: price,
      });
      if (!res.ok) {
        const b = await res.json();
        Alert.alert("Error", b.error || "Could not create booking");
        return;
      }
      const booking = await res.json();
      Alert.alert("Booked!", "Your booking request was sent. The handyman will accept shortly.", [
        { text: "View Booking", onPress: () => router.replace({ pathname: "/(customer)/booking-detail" as any, params: { id: booking.id } }) },
      ]);
    } catch {
      Alert.alert("Error", "Could not connect. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← Back</Text></TouchableOpacity>
        </View>
        <Text style={s.title}>Book Service</Text>
        <Text style={s.sub}>{serviceTitle}</Text>

        {/* Price preview */}
        <View style={s.priceCard}>
          <Text style={s.priceLabel}>Service Total</Text>
          <Text style={s.priceVal}>${price.toFixed(2)}</Text>
          <Text style={s.priceSub}>+10% platform fee at checkout</Text>
        </View>

        {/* Date picker */}
        <Text style={s.label}>Date & Time</Text>
        <TouchableOpacity style={s.dateBtn} onPress={() => setShowPicker(true)}>
          <Text style={s.dateBtnText}>📅 {fmt(scheduledAt)}</Text>
        </TouchableOpacity>
        {showPicker && (
          <DateTimePicker
            value={scheduledAt}
            mode="date"
            minimumDate={new Date()}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(_, d) => { setShowPicker(false); if (d) { setScheduledAt(prev => { const n = new Date(d); n.setHours(prev.getHours(), prev.getMinutes()); return n; }); setShowTimePicker(true); } }}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={scheduledAt}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(_, d) => { setShowTimePicker(false); if (d) setScheduledAt(d); }}
          />
        )}

        {/* Address autocomplete */}
        <Text style={s.label}>Service Address</Text>
        <GooglePlacesAutocomplete
          placeholder="123 Main St"
          fetchDetails={false}
          onPress={(data) => {
            const terms = data.terms ?? [];
            const street = terms.slice(0, -2).map(t => t.value).join(", ");
            const cityVal = terms.length >= 2 ? terms[terms.length - 2].value : "";
            setAddress(street || data.description);
            setCity(cityVal);
          }}
          query={{ key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, language: "en", components: "country:us", types: "address" }}
          textInputProps={{ value: address, onChangeText: setAddress, placeholderTextColor: C.slate500 }}
          styles={{
            container: { flex: 0 },
            textInput: { ...s.input, marginBottom: 0 },
            listView: { backgroundColor: "#1E293B", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
            row: { backgroundColor: "#1E293B", padding: 13 },
            description: { color: C.white, fontSize: 14 },
            separator: { backgroundColor: "rgba(255,255,255,0.07)" },
          }}
          keepResultsAfterBlur={false}
          enablePoweredByContainer={false}
        />

        <Text style={s.label}>City</Text>
        <TextInput style={s.input} value={city} onChangeText={setCity}
          placeholder="Los Angeles" placeholderTextColor={C.slate500} autoCapitalize="words" />

        {/* Notes */}
        <Text style={s.label}>Notes <Text style={s.opt}>(optional)</Text></Text>
        <TextInput style={[s.input, s.textArea]} value={notes} onChangeText={setNotes}
          placeholder="Describe the job, special instructions…" placeholderTextColor={C.slate500}
          multiline numberOfLines={4} textAlignVertical="top" />

        {/* Notice */}
        <View style={s.notice}>
          <Text style={s.noticeText}>💳 Payment is required after the handyman accepts your booking.</Text>
        </View>

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color={C.ink} /> : <Text style={s.btnText}>Request Booking</Text>}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.ink },
  scroll:     { padding: 20 },
  topBar:     { marginBottom: 8 },
  back:       { color: C.sky, fontSize: 15, fontWeight: "600" },
  title:      { color: C.white, fontSize: 26, fontWeight: "900", marginBottom: 2 },
  sub:        { color: C.slate400, fontSize: 14, marginBottom: 20 },
  priceCard:  { backgroundColor: "#1E293B", borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "rgba(56,189,248,0.2)" },
  priceLabel: { color: C.slate400, fontSize: 12, fontWeight: "600" },
  priceVal:   { color: C.sky, fontSize: 28, fontWeight: "900", marginVertical: 4 },
  priceSub:   { color: C.slate500, fontSize: 11 },
  label:      { color: C.slate400, fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 16 },
  opt:        { color: C.slate500, fontWeight: "400" },
  dateBtn:    { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  dateBtnText:{ color: C.white, fontSize: 15, fontWeight: "600" },
  input:      { backgroundColor: "#1E293B", borderRadius: 12, padding: 14, color: C.white, fontSize: 15, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  textArea:   { height: 100 },
  notice:     { backgroundColor: "rgba(56,189,248,0.07)", borderRadius: 10, padding: 12, marginTop: 20, borderWidth: 1, borderColor: "rgba(56,189,248,0.15)" },
  noticeText: { color: C.slate400, fontSize: 13, lineHeight: 19 },
  btn:        { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 24 },
  btnDisabled:{ opacity: 0.6 },
  btnText:    { color: C.ink, fontWeight: "900", fontSize: 16 },
});

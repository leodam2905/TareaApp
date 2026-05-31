import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Linking } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";
import { SafeAreaView } from "react-native-safe-area-context";

export default function BackgroundCheckScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const choose = async (method: "now" | "deferred") => {
    setLoading(true);
    const res = await api.post("/handyman/background-check", { method });
    if (res.ok) {
      const data = await res.json();
      if (method === "now" && data.checkoutUrl) {
        await Linking.openURL(data.checkoutUrl);
      } else {
        Alert.alert("Got it!", "$29.99 will be deducted from your first payout.", [
          { text: "Go to Dashboard", onPress: () => router.replace("/(handyman)/tabs/dashboard") },
        ]);
      }
    } else {
      Alert.alert("Error", "Something went wrong. Try again.");
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <Text style={s.title}>Background Check</Text>
        <Text style={s.sub}>Required before you can receive job requests from customers.</Text>

        <View style={s.infoCard}>
          <Text style={s.infoEmoji}>🛡️</Text>
          <Text style={s.infoText}>All Tarea handymen must pass a background check. This protects customers and builds trust. One-time fee: <Text style={s.infoBold}>$29.99</Text></Text>
        </View>

        {/* Pay now */}
        <TouchableOpacity style={s.optionCard} onPress={() => choose("now")} disabled={loading}>
          <View style={s.optionIcon}><Text style={{ fontSize: 24 }}>💳</Text></View>
          <View style={s.optionBody}>
            <Text style={s.optionTitle}>Pay Now — $29.99</Text>
            <Text style={s.optionDesc}>Pay by card via Stripe. Check starts immediately and typically completes in 1–3 business days.</Text>
          </View>
        </TouchableOpacity>

        {/* Deferred */}
        <TouchableOpacity style={[s.optionCard, s.optionCardSecondary]} onPress={() => choose("deferred")} disabled={loading}>
          <View style={[s.optionIcon, s.optionIconSecondary]}><Text style={{ fontSize: 24 }}>⏳</Text></View>
          <View style={s.optionBody}>
            <Text style={s.optionTitle}>Deduct from First Payout</Text>
            <Text style={s.optionDesc}>Start working now. The $29.99 fee will be automatically deducted from your first cashout.</Text>
          </View>
        </TouchableOpacity>

        {loading && <ActivityIndicator color={C.sky} style={{ marginTop: 16 }} />}

        <Text style={s.note}>You can accept bookings while your check is processing. Tarea uses Checkr for all background screenings.</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:                { flex: 1, backgroundColor: C.ink },
  container:           { flex: 1, padding: 24, gap: 16 },
  title:               { color: C.white, fontSize: 26, fontWeight: "900" },
  sub:                 { color: C.slate400, fontSize: 14, lineHeight: 20 },
  infoCard:            { flexDirection: "row", gap: 14, backgroundColor: "rgba(56,189,248,0.08)", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(56,189,248,0.15)", alignItems: "flex-start" },
  infoEmoji:           { fontSize: 28 },
  infoText:            { flex: 1, color: C.slate300, fontSize: 14, lineHeight: 20 },
  infoBold:            { color: C.white, fontWeight: "700" },
  optionCard:          { flexDirection: "row", gap: 14, backgroundColor: "#1E293B", borderRadius: 18, padding: 18, borderWidth: 2, borderColor: C.sky, alignItems: "flex-start" },
  optionCardSecondary: { borderColor: "rgba(255,255,255,0.1)" },
  optionIcon:          { width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(56,189,248,0.15)", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  optionIconSecondary: { backgroundColor: "rgba(255,255,255,0.07)" },
  optionBody:          { flex: 1 },
  optionTitle:         { color: C.white, fontWeight: "800", fontSize: 16, marginBottom: 4 },
  optionDesc:          { color: C.slate400, fontSize: 13, lineHeight: 19 },
  note:                { color: C.slate600, fontSize: 12, textAlign: "center", lineHeight: 18 },
});

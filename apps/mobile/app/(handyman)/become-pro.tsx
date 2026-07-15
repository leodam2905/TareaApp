import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { saveRole, clearAuth } from "@/lib/storage";
import { C } from "@/constants/colors";
import { SafeAreaView } from "react-native-safe-area-context";

const PERKS = [
  { emoji: "🛠️", title: "Get paid to work",     desc: "Accept jobs near you and cash out fast." },
  { emoji: "📅", title: "Your own schedule",     desc: "Set the days and hours you're available." },
  { emoji: "🛡️", title: "Verified & trusted",    desc: "A one-time background check builds customer trust." },
];

export default function BecomeProScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const becomePro = async () => {
    setLoading(true);
    try {
      const res = await api.post("/handyman/become-pro", {});
      if (res.ok) {
        await saveRole("HANDYMAN");
        router.replace("/(handyman)/setup-checklist");
      } else {
        Alert.alert("Something went wrong", "Couldn't start Pro setup. Please try again.");
      }
    } catch {
      Alert.alert("Network error", "Please check your connection and try again.");
    }
    setLoading(false);
  };

  const notNow = async () => { await clearAuth(); router.replace("/(auth)/landing" as any); };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Become a Tarea Pro</Text>
          <Text style={s.sub}>Your account is ready to start earning. Turn on Pro to receive jobs — you can still hire in the Tarea app anytime.</Text>
        </View>

        <View style={s.perks}>
          {PERKS.map(p => (
            <View key={p.title} style={s.perk}>
              <Text style={s.perkEmoji}>{p.emoji}</Text>
              <View style={s.perkBody}>
                <Text style={s.perkTitle}>{p.title}</Text>
                <Text style={s.perkDesc}>{p.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={becomePro} disabled={loading}>
          {loading ? <ActivityIndicator color={C.ink} /> : <Text style={s.btnText}>Get Started →</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={s.secondary} onPress={notNow} disabled={loading}>
          <Text style={s.secondaryText}>Not now — sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.ink },
  container:     { flex: 1, padding: 24 },
  header:        { paddingTop: 12, gap: 8 },
  title:         { color: C.white, fontSize: 28, fontWeight: "900" },
  sub:           { color: C.slate400, fontSize: 14, lineHeight: 21 },
  perks:         { marginTop: 28, gap: 16 },
  perk:          { flexDirection: "row", gap: 14, alignItems: "flex-start", backgroundColor: "#1E293B", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  perkEmoji:     { fontSize: 26 },
  perkBody:      { flex: 1 },
  perkTitle:     { color: C.white, fontWeight: "800", fontSize: 15 },
  perkDesc:      { color: C.slate400, fontSize: 13, marginTop: 2, lineHeight: 18 },
  btn:           { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  btnDisabled:   { opacity: 0.5 },
  btnText:       { color: C.ink, fontWeight: "800", fontSize: 16 },
  secondary:     { alignItems: "center", paddingVertical: 14 },
  secondaryText: { color: C.slate500, fontSize: 14, fontWeight: "600" },
});

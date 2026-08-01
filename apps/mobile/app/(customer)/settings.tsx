import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import BackBar from "@/components/ui/BackBar";
import { SafeAreaView } from "react-native-safe-area-context";

const BLUE = "#2563EB", INK = "#0F172A", MUTED = "#64748B", SURFACE = "#F1F5F9", LINE = "#E2E8F0";
const SUPPORT_EMAIL = "support@taptarea.com";

const GROUPS = [
  { key: "pref_currency", title: "Preferred Currency", options: [
    { value: "USD", label: "US Dollar ($)" }, { value: "EUR", label: "Euro (€)" },
    { value: "GBP", label: "British Pound (£)" }, { value: "CAD", label: "Canadian Dollar (C$)" },
  ], def: "USD" },
  { key: "pref_language", title: "Preferred Language", options: [
    { value: "en", label: "English" }, { value: "es", label: "Español" }, { value: "fr", label: "Français" },
  ], def: "en" },
];

export default function CustomerSettingsScreen() {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const v: Record<string, string> = {};
      for (const g of GROUPS) v[g.key] = (await SecureStore.getItemAsync(g.key)) || g.def;
      setValues(v);
    })();
  }, []);

  const select = (key: string, value: string) => {
    setValues(p => ({ ...p, [key]: value }));
    SecureStore.setItemAsync(key, value).catch(() => {});
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <BackBar fallback="/(customer)/tabs/profile" />
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>Settings</Text>

        {GROUPS.map(g => (
          <View key={g.key} style={s.card}>
            <Text style={s.cardTitle}>{g.title}</Text>
            {g.options.map((o, i) => {
              const sel = values[g.key] === o.value;
              return (
                <TouchableOpacity key={o.value} style={[s.row, i < g.options.length - 1 && s.rowBorder]} onPress={() => select(g.key, o.value)}>
                  <Text style={[s.rowLabel, sel && s.rowLabelSel]}>{o.label}</Text>
                  {sel && <Ionicons name="checkmark-circle" size={22} color={BLUE} />}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Privacy & permissions */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Privacy & Permissions</Text>
          <TouchableOpacity style={[s.row, s.rowBorder]} onPress={() => Linking.openSettings()}>
            <View style={s.rowLeft}><Ionicons name="location-outline" size={20} color={MUTED} /><Text style={s.rowLabel}>Location access</Text></View>
            <Ionicons name="open-outline" size={18} color={MUTED} />
          </TouchableOpacity>
          <TouchableOpacity style={s.row} onPress={() => Linking.openSettings()}>
            <View style={s.rowLeft}><Ionicons name="notifications-outline" size={20} color={MUTED} /><Text style={s.rowLabel}>Notifications</Text></View>
            <Ionicons name="open-outline" size={18} color={MUTED} />
          </TouchableOpacity>
        </View>

        {/* Support & legal */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Support & Legal</Text>
          <TouchableOpacity style={[s.row, s.rowBorder]} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Tarea%20Support`)}>
            <View style={s.rowLeft}><Ionicons name="mail-outline" size={20} color={MUTED} /><Text style={s.rowLabel}>Contact support</Text></View>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
          <TouchableOpacity style={[s.row, s.rowBorder]} onPress={() => Linking.openURL("https://taptarea.com/terms")}>
            <View style={s.rowLeft}><Ionicons name="document-text-outline" size={20} color={MUTED} /><Text style={s.rowLabel}>Terms of Service</Text></View>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
          <TouchableOpacity style={s.row} onPress={() => Linking.openURL("https://taptarea.com/privacy")}>
            <View style={s.rowLeft}><Ionicons name="shield-checkmark-outline" size={20} color={MUTED} /><Text style={s.rowLabel}>Privacy Policy</Text></View>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>
        </View>

        <Text style={s.note}>Currency and language are saved on this device. Full app-wide support is rolling out soon.</Text>
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: "#FFFFFF" },
  scroll:    { padding: 16 },
  title:     { color: INK, fontSize: 28, fontWeight: "900", marginBottom: 12, marginLeft: 4 },
  card:      { backgroundColor: SURFACE, borderRadius: 18, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2, marginBottom: 14, borderWidth: 1, borderColor: LINE },
  cardTitle: { color: MUTED, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  row:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  rowLeft:   { flexDirection: "row", alignItems: "center", gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: LINE },
  rowLabel:  { color: INK, fontSize: 15 },
  rowLabelSel:{ fontWeight: "700" },
  note:      { color: MUTED, fontSize: 12, lineHeight: 17, marginHorizontal: 4, marginTop: 4 },
});

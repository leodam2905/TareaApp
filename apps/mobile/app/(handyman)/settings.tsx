import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/colors";
import BackBar from "@/components/ui/BackBar";
import { SafeAreaView } from "react-native-safe-area-context";

const BLUE = "#2563EB";

const GROUPS = [
  { key: "pref_currency", title: "Preferred Currency", options: [
    { value: "USD", label: "US Dollar ($)" }, { value: "EUR", label: "Euro (€)" },
    { value: "GBP", label: "British Pound (£)" }, { value: "CAD", label: "Canadian Dollar (C$)" },
  ], def: "USD" },
  { key: "pref_language", title: "Preferred Language", options: [
    { value: "en", label: "English" }, { value: "es", label: "Español" }, { value: "fr", label: "Français" },
  ], def: "en" },
];

export default function SettingsScreen() {
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
      <BackBar />
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

        <Text style={s.note}>Your preferences are saved on this device. Full app-wide currency and language support are rolling out soon.</Text>
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: C.bg },
  scroll:    { padding: 16 },
  title:     { color: C.text, fontSize: 28, fontWeight: "900", marginBottom: 12, marginLeft: 4 },
  card:      { backgroundColor: C.surface, borderRadius: 18, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2, marginBottom: 14, borderWidth: 1, borderColor: C.line },
  cardTitle: { color: C.textMuted, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  row:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  rowLabel:  { color: C.text, fontSize: 15 },
  rowLabelSel:{ fontWeight: "700" },
  note:      { color: C.textMuted, fontSize: 12, lineHeight: 17, marginHorizontal: 4, marginTop: 4 },
});

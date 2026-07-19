import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/constants/colors";
import BackBar from "@/components/ui/BackBar";
import { SafeAreaView } from "react-native-safe-area-context";

const BLUE = "#2563EB";
const SUPPORT_EMAIL = "support@taptarea.com";
const SUPPORT_PHONE = "+1 (800) 000-0000"; // TODO: confirm real support number

function Row({ icon, label, value, onPress }: { icon: any; label: string; value?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress}>
      <View style={s.icon}><Ionicons name={icon} size={19} color={BLUE} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{label}</Text>
        {value ? <Text style={s.value}>{value}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
    </TouchableOpacity>
  );
}

export default function SupportScreen() {
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <BackBar />
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>Legal & Support</Text>

        <Text style={s.section}>CONTACT US</Text>
        <View style={s.card}>
          <Row icon="mail-outline" label="Email support" value={SUPPORT_EMAIL} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
          <View style={s.sep} />
          <Row icon="call-outline" label="Call support" value={SUPPORT_PHONE} onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE.replace(/[^\d+]/g, "")}`)} />
          <View style={s.sep} />
          <Row icon="chatbubbles-outline" label="Message support" value="Reply within 24h" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Tarea%20Pro%20Support`)} />
        </View>

        <Text style={s.section}>LEGAL</Text>
        <View style={s.card}>
          <Row icon="document-text-outline" label="Terms of Service" onPress={() => Linking.openURL("https://taptarea.com/terms")} />
          <View style={s.sep} />
          <Row icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => Linking.openURL("https://taptarea.com/privacy")} />
        </View>

        <Text style={s.footer}>Tarea Pro · support@taptarea.com</Text>
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  scroll:  { padding: 16 },
  title:   { color: C.text, fontSize: 28, fontWeight: "900", marginBottom: 16, marginLeft: 4 },
  section: { color: C.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 0.6, marginLeft: 4, marginBottom: 8, marginTop: 6 },
  card:    { backgroundColor: C.surface, borderRadius: 18, paddingHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: C.line },
  row:     { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  icon:    { width: 34, height: 34, borderRadius: 10, backgroundColor: "#EFF5FF", alignItems: "center", justifyContent: "center" },
  label:   { color: C.text, fontSize: 15, fontWeight: "600" },
  value:   { color: C.textMuted, fontSize: 13, marginTop: 2 },
  sep:     { height: 1, backgroundColor: C.line },
  footer:  { color: C.textMuted, fontSize: 12, textAlign: "center", marginTop: 8 },
});

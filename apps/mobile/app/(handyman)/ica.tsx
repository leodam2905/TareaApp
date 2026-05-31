import { useState, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ICAScreen() {
  const router = useRouter();
  const [scrolled, setScrolled]   = useState(false);
  const [checked, setChecked]     = useState(false);
  const [signing, setSigning]     = useState(false);

  const handleScroll = (e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 40) setScrolled(true);
  };

  const sign = async () => {
    if (!checked) { Alert.alert("Required", "Please check the agreement box first"); return; }
    setSigning(true);
    const res = await api.post("/handyman/ica", {});
    if (res.ok) {
      Alert.alert("Signed!", "Agreement recorded. Let's set up your profile.", [{ text: "Continue", onPress: () => router.replace("/(handyman)/onboarding-profile") }]);
    } else {
      Alert.alert("Error", "Failed to record signature. Try again.");
    }
    setSigning(false);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <Text style={s.title}>Independent Contractor Agreement</Text>
        <Text style={s.sub}>Scroll to the bottom, then sign to continue</Text>

        <ScrollView style={s.doc} onScroll={handleScroll} scrollEventThrottle={100}>
          <Text style={s.docHeading}>INDEPENDENT CONTRACTOR AGREEMENT</Text>
          <Text style={s.docMeta}>Tarea US LLC · Governing Law: California · AB5 Compliant</Text>

          {[
            ["1. Independent Contractor Status", "You are an independent contractor, not an employee of Tarea US LLC. You are free from Tarea's control, work outside Tarea's usual business, and operate your own independently established trade or business."],
            ["2. Platform Access", "You have full autonomy to set your own rates, hours, and service area. You may accept or decline any job request without penalty. You may work for other platforms simultaneously."],
            ["3. Licensing & Insurance", "You warrant that you hold all required licenses (including CSLB for work valued at $500+ in California) and maintain General Liability Insurance with minimum $1M per occurrence coverage."],
            ["4. Compensation", "You earn 90% of your stated service rate. Tarea retains a 10% platform fee. Customers pay an additional 15% service fee. Payouts are processed via Stripe Connect within 30 minutes of job completion."],
            ["5. Taxes", "You are solely responsible for all federal, state, and local taxes. Tarea will issue IRS Form 1099-NEC for earnings of $600+."],
            ["6. Non-Solicitation", "During this agreement and for 12 months after termination, you agree not to solicit Tarea customers to transact outside the platform for the same or similar services."],
            ["7. Dispute Resolution", "Disputes are resolved through binding individual arbitration in Los Angeles County, California. Class actions are waived."],
            ["8. Termination", "Either party may terminate at any time. Tarea may suspend access for violations, low ratings, or fraudulent conduct."],
          ].map(([title, body]) => (
            <View key={title} style={s.section}>
              <Text style={s.sectionTitle}>{title}</Text>
              <Text style={s.sectionBody}>{body}</Text>
            </View>
          ))}

          <View style={s.signature}>
            <Text style={s.sigText}>Signed on behalf of Tarea US LLC</Text>
            <Text style={s.sigName}>Debohi Jean Jacques Dah — CEO</Text>
            <Text style={s.sigFooter}>© 2026 Tarea US LLC · 400 N Oakland Ave, Pasadena CA 91101</Text>
          </View>
        </ScrollView>

        {scrolled && (
          <TouchableOpacity style={s.checkRow} onPress={() => setChecked(!checked)}>
            <View style={[s.checkbox, checked && s.checkboxChecked]}>
              {checked && <Text style={s.checkmark}>✓</Text>}
            </View>
            <Text style={s.checkLabel}>I have read and agree to the Independent Contractor Agreement. I understand I am an independent contractor, not an employee.</Text>
          </TouchableOpacity>
        )}

        {!scrolled && <Text style={s.hint}>↓ Scroll to the bottom to continue</Text>}

        <TouchableOpacity style={[s.btn, (!checked || signing) && s.btnDisabled]} onPress={sign} disabled={!checked || signing}>
          {signing ? <ActivityIndicator color={C.ink} /> : <Text style={s.btnText}>Sign & Continue</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: C.ink },
  container:       { flex: 1, padding: 20, gap: 12 },
  title:           { color: C.white, fontSize: 20, fontWeight: "900" },
  sub:             { color: C.slate400, fontSize: 13 },
  doc:             { flex: 1, backgroundColor: "#1E293B", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  docHeading:      { color: C.white, fontWeight: "900", fontSize: 16, textAlign: "center", marginBottom: 4 },
  docMeta:         { color: C.slate500, fontSize: 11, textAlign: "center", marginBottom: 16 },
  section:         { marginBottom: 16 },
  sectionTitle:    { color: C.sky, fontWeight: "700", fontSize: 13, marginBottom: 4 },
  sectionBody:     { color: C.slate400, fontSize: 13, lineHeight: 19 },
  signature:       { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)", paddingTop: 16, marginTop: 8, alignItems: "center", gap: 4 },
  sigText:         { color: C.slate500, fontSize: 11 },
  sigName:         { color: C.white, fontWeight: "700", fontSize: 13 },
  sigFooter:       { color: C.slate600, fontSize: 10, marginTop: 4 },
  checkRow:        { flexDirection: "row", gap: 12, alignItems: "flex-start", backgroundColor: "#1E293B", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  checkbox:        { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.slate500, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  checkboxChecked: { backgroundColor: C.sky, borderColor: C.sky },
  checkmark:       { color: C.ink, fontWeight: "900", fontSize: 13 },
  checkLabel:      { flex: 1, color: C.slate300, fontSize: 13, lineHeight: 19 },
  hint:            { color: C.slate500, textAlign: "center", fontSize: 13 },
  btn:             { backgroundColor: C.sky, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  btnDisabled:     { opacity: 0.35 },
  btnText:         { color: C.ink, fontWeight: "800", fontSize: 16 },
});

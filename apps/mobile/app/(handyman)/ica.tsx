import { useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../../constants/api";
import { colors, fontSize, radius, spacing } from "../../constants/theme";

export default function ICAScreen() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [checked, setChecked] = useState(false);
  const [signing, setSigning] = useState(false);

  const handleScroll = (e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 40) {
      setScrolled(true);
    }
  };

  const sign = async () => {
    if (!checked) { Alert.alert("Please check the agreement box first"); return; }
    setSigning(true);
    try {
      await api.post("/handyman/ica", {});
      router.replace("/(handyman)/background-check" as never);
    } catch {
      Alert.alert("Error", "Failed to record signature. Please try again.");
    }
    setSigning(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={["#0F2560", "#0F172A"]} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.iconWrap}>
            <Ionicons name="document-text" size={20} color={colors.skyBlue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Independent Contractor Agreement</Text>
            <Text style={styles.subtitle}>Required before accessing the platform</Text>
          </View>
        </View>
        <View style={styles.noticeBanner}>
          <Ionicons name="alert-circle" size={16} color="#F59E0B" />
          <Text style={styles.noticeText}>Read the full agreement below, then check the box to sign.</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        onScroll={handleScroll}
        scrollEventThrottle={200}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.docTitle}>INDEPENDENT CONTRACTOR AGREEMENT</Text>
        <Text style={styles.docMeta}>Platform Service Professional Agreement · Governing Law: State of California · AB5 Compliant</Text>

        <View style={styles.partiesBox}>
          <Text style={styles.partiesTitle}>PARTIES</Text>
          <Text style={styles.partiesText}><Text style={styles.bold}>Platform Company:</Text> Tarea US LLC, a California LLC</Text>
          <Text style={styles.partiesText}><Text style={styles.bold}>Principal Office:</Text> 400 N Oakland Avenue, Apt 209, Pasadena, CA 91101</Text>
          <Text style={styles.partiesText}><Text style={styles.bold}>Email:</Text> support@taptarea.com</Text>
          <Text style={[styles.partiesText, { marginTop: 8 }]}>AND the Pro whose account is accepting this Agreement electronically.</Text>
        </View>

        <Text style={styles.body}>This Independent Contractor Agreement ("Agreement") is entered into as of the date the Pro electronically accepts through the Tarea platform onboarding process ("Effective Date").</Text>

        <Text style={[styles.body, styles.warning]}>IMPORTANT: BY SIGNING OR ELECTRONICALLY ACCEPTING THIS AGREEMENT, THE PRO ACKNOWLEDGES THAT THEY HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY ALL TERMS AND CONDITIONS HEREIN.</Text>

        <Text style={styles.sectionTitle}>1. Independent Contractor Status — AB5 Compliance</Text>
        <Text style={styles.body}><Text style={styles.bold}>1.1 — Independent Contractor Relationship.</Text> The Pro is and shall at all times remain an independent contractor and not an employee, agent, partner, joint venturer, or franchisee of Tarea. This Agreement does not create an employment relationship of any kind. The Parties expressly intend to maintain an independent contractor relationship consistent with California AB5, California Labor Code §§ 3350–3371, and applicable federal law.</Text>
        <Text style={styles.body}><Text style={styles.bold}>1.2 — ABC Test Compliance (Cal. Lab. Code § 2775).</Text> The Pro represents and warrants: (A) Freedom from Control — The Pro is free from Tarea's control and direction in the performance of services; (B) Work Outside Usual Course of Business — Tarea is a software technology company, not a home services company; (C) Independently Established Trade — The Pro operates their own business, holds required licenses, and is available to serve multiple clients.</Text>
        <Text style={styles.body}><Text style={styles.bold}>1.3 — No Employment Benefits.</Text> As an independent contractor, the Pro is not entitled to wages, workers' compensation, unemployment insurance, health benefits, retirement plans, paid time off, sick leave, or any other employment benefit.</Text>
        <Text style={styles.body}><Text style={styles.bold}>1.4 — Tax Obligations.</Text> The Pro is solely responsible for all federal, state, and local taxes on earnings, including self-employment taxes. Tarea will issue IRS Form 1099-NEC for annual earnings of $600 or more.</Text>

        <Text style={styles.sectionTitle}>2. Platform Access and Use</Text>
        <Text style={styles.body}><Text style={styles.bold}>2.1 — Pro Autonomy.</Text> The Pro may set their own rates, hours, service area; accept or decline any job; and work for competitors simultaneously. There is no exclusivity obligation.</Text>
        <Text style={styles.body}><Text style={styles.bold}>2.2 — Platform Rules.</Text> The Pro agrees to maintain required licenses and insurance, treat Customers professionally, accurately represent qualifications, and not solicit Customers off-platform during this Agreement and for 12 months after termination.</Text>

        <Text style={styles.sectionTitle}>3. Licensing, Insurance, and Compliance</Text>
        <Text style={styles.body}><Text style={styles.bold}>3.1 — Required Licenses.</Text> The Pro warrants they hold all required licenses including California CSLB license for work valued at $500+ in labor and materials (Cal. Bus. &amp; Prof. Code § 7028) and any applicable trade-specific or local business license.</Text>
        <Text style={styles.body}><Text style={styles.bold}>3.2 — Insurance Requirements.</Text> The Pro must maintain: General Liability Insurance (min $1,000,000 per occurrence / $2,000,000 aggregate); Commercial Auto Insurance if driving to job sites; Workers' Compensation if the Pro employs others.</Text>

        <Text style={styles.sectionTitle}>4. Compensation and Payments</Text>
        <Text style={styles.body}><Text style={styles.bold}>4.1 — Fee Structure.</Text> The Pro earns 90% of their stated service rate. Tarea retains a 10% platform fee. Customers pay an additional 15% service fee on top of the Pro's rate.</Text>
        <Text style={styles.body}><Text style={styles.bold}>4.2 — Payout Processing.</Text> Payouts are processed via Stripe Connect, typically within 30 minutes of job completion.</Text>
        <Text style={styles.body}><Text style={styles.bold}>4.3 — Cancellation Compensation.</Text> If a Customer cancels a confirmed booking within 24 hours, the Pro receives 50% of the agreed rate.</Text>

        <Text style={styles.sectionTitle}>5. Tools and Equipment</Text>
        <Text style={styles.body}>The Pro is solely responsible for providing all tools, equipment, vehicles, materials, and supplies necessary to perform services. Tarea shall not provide, reimburse, or subsidize any tools or expenses.</Text>

        <Text style={styles.sectionTitle}>6. Confidentiality</Text>
        <Text style={styles.body}>The Pro agrees to keep confidential all non-public information regarding Tarea's business, technology, Customer data, and trade secrets. This obligation survives termination for three (3) years.</Text>

        <Text style={styles.sectionTitle}>7. Indemnification and Liability</Text>
        <Text style={styles.body}><Text style={styles.bold}>7.1 — Pro Indemnification.</Text> The Pro shall indemnify Tarea from any claims arising out of their services, breach of this Agreement, any injury or property damage, or failure to maintain required licenses or insurance.</Text>
        <Text style={[styles.body, { textTransform: "uppercase", fontSize: 10 }]}><Text style={styles.bold}>7.2 — Limitation of Liability.</Text> TO THE MAXIMUM EXTENT PERMITTED BY LAW, TAREA'S TOTAL LIABILITY SHALL NOT EXCEED THE TOTAL PLATFORM FEES PAID IN THE THREE (3) MONTHS PRECEDING THE CLAIM. TAREA SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES.</Text>

        <Text style={styles.sectionTitle}>8. Non-Solicitation</Text>
        <Text style={styles.body}>During this Agreement and for twelve (12) months following termination, the Pro agrees not to directly solicit Customers introduced through Tarea to transact outside the Platform. This is not a non-compete — the Pro may freely work for other clients and platforms.</Text>

        <Text style={styles.sectionTitle}>9. Dispute Resolution and Arbitration</Text>
        <Text style={styles.body}><Text style={styles.bold}>9.1 — Informal Resolution.</Text> The Parties will attempt in good faith to resolve any dispute for thirty (30) days before formal proceedings.</Text>
        <Text style={styles.body}><Text style={styles.bold}>9.2 — Binding Arbitration.</Text> Any unresolved dispute shall be resolved by binding individual arbitration administered by JAMS or AAA in Los Angeles County, California.</Text>
        <Text style={[styles.body, { textTransform: "uppercase", fontSize: 10 }]}><Text style={styles.bold}>9.3 — Class Action Waiver.</Text> THE PRO WAIVES THE RIGHT TO PARTICIPATE IN ANY CLASS ACTION OR COLLECTIVE PROCEEDING. ALL DISPUTES MUST BE BROUGHT INDIVIDUALLY.</Text>

        <Text style={styles.sectionTitle}>10. Governing Law</Text>
        <Text style={styles.body}>This Agreement is governed by California law. Any claims not subject to arbitration shall be brought in courts of Los Angeles County, California.</Text>

        <View style={styles.signatureBlock}>
          <Text style={styles.signatureTitle}>EXECUTION</Text>
          <Text style={styles.signatureBody}>By clicking "Sign &amp; Continue" below, you electronically sign this Agreement. Your electronic signature, IP address, and timestamp will be recorded as legally binding evidence of acceptance under the California Uniform Electronic Transactions Act and the federal E-SIGN Act.</Text>
          <Text style={styles.companySig}>Debohi Jean Jacques Dah</Text>
          <Text style={styles.companyRole}>Chief Executive Officer, Tarea US LLC</Text>
          <Text style={styles.companyNote}>© 2026 Tarea US LLC · 400 N Oakland Ave, Apt 209, Pasadena, CA 91101</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {!scrolled && (
          <View style={styles.scrollHint}>
            <Ionicons name="arrow-down" size={14} color={colors.inkSubtle} />
            <Text style={styles.scrollHintText}>Scroll to the bottom to continue</Text>
          </View>
        )}

        {scrolled && (
          <Pressable style={styles.checkRow} onPress={() => setChecked(!checked)}>
            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
              {checked && <Ionicons name="checkmark" size={14} color={colors.white} />}
            </View>
            <Text style={styles.checkLabel}>
              I have read and agree to the Independent Contractor Agreement. I understand I am an{" "}
              <Text style={styles.bold}>independent contractor</Text>, not an employee of Tarea US LLC,
              and am responsible for my own taxes, licenses, and insurance.
            </Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.signBtn, (!checked || signing) && styles.signBtnDisabled]}
          onPress={sign}
          disabled={!checked || signing}
        >
          {signing
            ? <ActivityIndicator color={colors.ink} size="small" />
            : <Ionicons name="create" size={18} color={colors.ink} />}
          <Text style={styles.signBtnText}>{signing ? "Recording signature…" : "Sign & Continue"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: spacing.xl },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.md },
  iconWrap: { width: 40, height: 40, borderRadius: radius.lg, backgroundColor: "rgba(56,189,248,0.15)", alignItems: "center", justifyContent: "center" },
  title: { fontSize: fontSize.lg, fontWeight: "800", color: colors.white, lineHeight: 22 },
  subtitle: { fontSize: fontSize.xs, color: colors.inkSubtle, marginTop: 2 },
  noticeBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "rgba(245,158,11,0.12)", borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: "rgba(245,158,11,0.25)" },
  noticeText: { flex: 1, fontSize: fontSize.xs, color: "#FCD34D", lineHeight: 18 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.xl, paddingBottom: 20 },
  docTitle: { fontSize: fontSize.lg, fontWeight: "900", color: colors.white, textAlign: "center", marginBottom: 4 },
  docMeta: { fontSize: 10, color: colors.inkSubtle, textAlign: "center", marginBottom: spacing.lg },
  partiesBox: { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", marginBottom: spacing.md, gap: 4 },
  partiesTitle: { fontSize: fontSize.xs, fontWeight: "700", color: colors.white, marginBottom: 4 },
  partiesText: { fontSize: 12, color: colors.inkSubtle, lineHeight: 18 },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: "800", color: colors.white, marginTop: spacing.lg, marginBottom: spacing.sm },
  body: { fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 20, marginBottom: spacing.sm },
  bold: { color: "rgba(255,255,255,0.85)", fontWeight: "700" },
  warning: { color: "#FCD34D", fontWeight: "700", fontSize: 11 },
  signatureBlock: { marginTop: spacing.xl, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", paddingTop: spacing.lg, alignItems: "center", gap: 4 },
  signatureTitle: { fontSize: fontSize.base, fontWeight: "800", color: colors.white },
  signatureBody: { fontSize: 11, color: colors.inkSubtle, textAlign: "center", lineHeight: 17, marginBottom: spacing.sm },
  companySig: { fontSize: fontSize.xl, color: colors.skyBlue, fontStyle: "italic", fontWeight: "700" },
  companyRole: { fontSize: 11, color: colors.inkSubtle },
  companyNote: { fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 4 },
  footer: { backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)", padding: spacing.xl, paddingBottom: 40, gap: spacing.md },
  scrollHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  scrollHintText: { fontSize: fontSize.xs, color: colors.inkSubtle },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.inkSubtle, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  checkboxChecked: { backgroundColor: colors.skyBlue, borderColor: colors.skyBlue },
  checkLabel: { flex: 1, fontSize: fontSize.xs, color: "rgba(255,255,255,0.7)", lineHeight: 18 },
  signBtn: { backgroundColor: colors.skyBlue, borderRadius: radius.lg, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  signBtnDisabled: { opacity: 0.4 },
  signBtnText: { fontSize: fontSize.base, fontWeight: "800", color: colors.ink },
});

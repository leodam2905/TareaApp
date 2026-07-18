import { useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useState } from "react";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";
import BackBar from "@/components/ui/BackBar";
import { SafeAreaView } from "react-native-safe-area-context";

type Checklist = { ica: boolean; profile: boolean; services: boolean; availability: boolean; backgroundCheck: boolean; stripe: boolean; backgroundCheckStatus?: string };

const STEP_KEYS = ["ica", "profile", "services", "availability", "backgroundCheck", "stripe"] as const;
const BG_PENDING = ["DEFERRED", "PAID", "IN_PROGRESS"];

const STEPS = [
  { key: "ica",             label: "Sign Contractor Agreement",  desc: "Read and e-sign the Independent Contractor Agreement.",            href: "/(handyman)/ica",                       requires: null },
  { key: "profile",         label: "Complete Your Profile",      desc: "Add a profile photo, bio, and upload your government ID.",         href: "/(handyman)/onboarding-profile",        requires: "ica" },
  { key: "services",        label: "Add Your Services",          desc: "Select the services you offer with pricing and duration.",         href: "/(handyman)/onboarding-services",       requires: "profile" },
  { key: "availability",    label: "Set Your Availability",      desc: "Choose the days and hours you're open for bookings.",             href: "/(handyman)/onboarding-availability",   requires: "services" },
  { key: "backgroundCheck", label: "Complete Background Check",  desc: "One-time $29.99 check required before receiving bookings.",       href: "/(handyman)/background-check",          requires: "availability" },
  { key: "stripe",          label: "Connect Stripe to Get Paid", desc: "Link your bank account to receive payouts for completed jobs.",   href: "/(handyman)/tabs/earnings",             requires: "backgroundCheck" },
] as const;

export default function SetupChecklistScreen() {
  const router = useRouter();
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get("/handyman/checklist");
    if (res.ok) setChecklist(await res.json());
    setLoading(false); setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={s.center}><ActivityIndicator color={C.sky} size="large" /></View>;

  // Background check is only truly "complete" once admin-approves it (PASSED).
  // Paid/deferred counts toward unlocking later steps but shows as "Pending".
  const bgStatus    = checklist?.backgroundCheckStatus;
  const hasBgStatus = typeof bgStatus === "string";
  const bgComplete  = bgStatus === "PASSED";
  const bgPending   = hasBgStatus && BG_PENDING.includes(bgStatus);

  const isStepComplete = (key: (typeof STEP_KEYS)[number]) => {
    if (key === "backgroundCheck") return hasBgStatus ? bgComplete : (checklist?.backgroundCheck ?? false);
    return checklist?.[key] ?? false;
  };

  const completedCount = checklist ? STEP_KEYS.filter(isStepComplete).length : 0;
  const allDone = completedCount === 6;
  const pct = (completedCount / 6) * 100;

  return (
    <SafeAreaView style={s.safe}>
      <BackBar />
      <ScrollView style={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.sky} />}>
        <View style={s.header}>
          <Text style={s.title}>Setup Checklist</Text>
          <Text style={s.sub}>Complete all steps to start receiving bookings</Text>
        </View>

        {/* Progress */}
        <View style={s.progressCard}>
          <View style={s.progressTop}>
            <Text style={s.progressLabel}>{allDone ? "All steps complete — you're live! 🎉" : `${completedCount} of 6 steps complete`}</Text>
            <Text style={[s.progressCount, { color: allDone ? C.emerald : C.amber }]}>{completedCount}<Text style={s.progressTotal}>/6</Text></Text>
          </View>
          <View style={s.track}>
            <View style={[s.fill, { width: `${pct}%` as any, backgroundColor: allDone ? C.emerald : C.sky }]} />
          </View>
        </View>

        {/* Steps */}
        <View style={s.steps}>
          {STEPS.map((step, index) => {
            const isBg   = step.key === "backgroundCheck";
            const done   = isStepComplete(step.key as (typeof STEP_KEYS)[number]);
            const pending = isBg && bgPending && !bgComplete;
            const locked = step.requires !== null && !(checklist?.[step.requires as keyof Checklist] ?? false);

            const label = isBg && bgComplete ? "Background Check Complete"
                        : isBg && pending    ? "Background Check Pending"
                        : step.label;
            const desc  = isBg && bgComplete ? "Approved by Tarea — you're fully verified."
                        : isBg && pending    ? "Payment received. Your check is under review — you can accept jobs while it processes."
                        : step.desc;

            return (
              <TouchableOpacity
                key={step.key}
                style={[s.stepCard, done && s.stepDone, pending && s.stepPending, locked && s.stepLocked]}
                onPress={() => !done && !pending && !locked && router.push(step.href as any)}
                disabled={done || pending || locked}
              >
                {/* Circle */}
                <View style={[s.circle, done && s.circleDone, pending && s.circlePending, locked && s.circleLocked]}>
                  <Text style={s.circleText}>{done ? "✓" : pending ? "⏳" : locked ? "🔒" : String(index + 1)}</Text>
                </View>

                {/* Text */}
                <View style={s.stepBody}>
                  <Text style={[s.stepLabel, done && s.stepLabelDone, locked && s.stepLabelLocked]}>{label}</Text>
                  <Text style={s.stepDesc}>{desc}</Text>
                </View>

                {/* Badge */}
                {done ? (
                  <View style={s.doneBadge}><Text style={s.doneBadgeText}>Done</Text></View>
                ) : pending ? (
                  <View style={s.pendingBadge}><Text style={s.pendingBadgeText}>Pending</Text></View>
                ) : locked ? (
                  <View style={s.lockedBadge}><Text style={s.lockedBadgeText}>Locked</Text></View>
                ) : (
                  <View style={s.startBadge}><Text style={s.startBadgeText}>Start →</Text></View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.hint}>Steps unlock in order · Pull down to refresh</Text>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: C.bg },
  scroll:           { flex: 1 },
  center:           { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  header:           { padding: 24, paddingBottom: 12 },
  title:            { color: C.text, fontSize: 28, fontWeight: "900" },
  sub:              { color: C.textMuted, fontSize: 14, marginTop: 2 },
  progressCard:     { marginHorizontal: 16, marginBottom: 16, backgroundColor: C.surface, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.line },
  progressTop:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  progressLabel:    { color: C.textMuted, fontSize: 13, fontWeight: "600", flex: 1 },
  progressCount:    { fontSize: 28, fontWeight: "900" },
  progressTotal:    { fontSize: 16, color: C.slate500, fontWeight: "400" },
  track:            { height: 8, backgroundColor: C.surface, borderRadius: 4, overflow: "hidden" },
  fill:             { height: 8, borderRadius: 4 },
  steps:            { paddingHorizontal: 16, gap: 10 },
  stepCard:         { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.line },
  stepDone:         { borderColor: "rgba(16,185,129,0.2)", backgroundColor: "rgba(16,185,129,0.04)" },
  stepPending:      { borderColor: "rgba(245,158,11,0.35)", backgroundColor: "rgba(245,158,11,0.06)" },
  stepLocked:       { opacity: 0.4 },
  circle:           { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(56,189,248,0.15)", borderWidth: 1, borderColor: "rgba(56,189,248,0.3)", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  circleDone:       { backgroundColor: C.emerald, borderColor: C.emerald },
  circlePending:    { backgroundColor: "rgba(245,158,11,0.18)", borderColor: "rgba(245,158,11,0.4)" },
  circleLocked:     { backgroundColor: C.surface, borderColor: C.line },
  circleText:       { color: C.text, fontWeight: "900", fontSize: 13 },
  stepBody:         { flex: 1 },
  stepLabel:        { color: C.text, fontWeight: "700", fontSize: 14 },
  stepLabelDone:    { color: C.textMuted, textDecorationLine: "line-through" },
  stepLabelLocked:  { color: C.slate600 },
  stepDesc:         { color: C.slate500, fontSize: 12, marginTop: 2, lineHeight: 16 },
  doneBadge:        { backgroundColor: "rgba(16,185,129,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  doneBadgeText:    { color: C.emerald, fontSize: 11, fontWeight: "700" },
  pendingBadge:     { backgroundColor: "rgba(245,158,11,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pendingBadgeText: { color: C.amber, fontSize: 11, fontWeight: "700" },
  lockedBadge:      { backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  lockedBadgeText:  { color: C.slate600, fontSize: 11, fontWeight: "700" },
  startBadge:       { backgroundColor: "rgba(56,189,248,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  startBadgeText:   { color: C.sky, fontSize: 11, fontWeight: "700" },
  hint:             { textAlign: "center", color: C.slate600, fontSize: 12, marginTop: 16 },
});

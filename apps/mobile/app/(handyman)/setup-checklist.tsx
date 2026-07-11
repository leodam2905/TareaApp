import { useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useState } from "react";
import { api } from "@/lib/api";
import { C } from "@/constants/colors";
import BackBar from "@/components/ui/BackBar";
import { SafeAreaView } from "react-native-safe-area-context";

type Checklist = { ica: boolean; profile: boolean; services: boolean; availability: boolean; backgroundCheck: boolean; stripe: boolean };

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

  const completedCount = checklist ? Object.values(checklist).filter(Boolean).length : 0;
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
            const done   = checklist?.[step.key as keyof Checklist] ?? false;
            const locked = step.requires !== null && !(checklist?.[step.requires as keyof Checklist] ?? false);
            return (
              <TouchableOpacity
                key={step.key}
                style={[s.stepCard, done && s.stepDone, locked && s.stepLocked]}
                onPress={() => !done && !locked && router.push(step.href as any)}
                disabled={done || locked}
              >
                {/* Circle */}
                <View style={[s.circle, done && s.circleDone, locked && s.circleLocked]}>
                  <Text style={s.circleText}>{done ? "✓" : locked ? "🔒" : String(index + 1)}</Text>
                </View>

                {/* Text */}
                <View style={s.stepBody}>
                  <Text style={[s.stepLabel, done && s.stepLabelDone, locked && s.stepLabelLocked]}>{step.label}</Text>
                  <Text style={s.stepDesc}>{step.desc}</Text>
                </View>

                {/* Badge */}
                {done ? (
                  <View style={s.doneBadge}><Text style={s.doneBadgeText}>Done</Text></View>
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
  safe:             { flex: 1, backgroundColor: C.ink },
  scroll:           { flex: 1 },
  center:           { flex: 1, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  header:           { padding: 24, paddingBottom: 12 },
  title:            { color: C.white, fontSize: 28, fontWeight: "900" },
  sub:              { color: C.slate400, fontSize: 14, marginTop: 2 },
  progressCard:     { marginHorizontal: 16, marginBottom: 16, backgroundColor: "#1E293B", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  progressTop:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  progressLabel:    { color: C.slate300, fontSize: 13, fontWeight: "600", flex: 1 },
  progressCount:    { fontSize: 28, fontWeight: "900" },
  progressTotal:    { fontSize: 16, color: C.slate500, fontWeight: "400" },
  track:            { height: 8, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" },
  fill:             { height: 8, borderRadius: 4 },
  steps:            { paddingHorizontal: 16, gap: 10 },
  stepCard:         { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#1E293B", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  stepDone:         { borderColor: "rgba(16,185,129,0.2)", backgroundColor: "rgba(16,185,129,0.04)" },
  stepLocked:       { opacity: 0.4 },
  circle:           { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(56,189,248,0.15)", borderWidth: 1, borderColor: "rgba(56,189,248,0.3)", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  circleDone:       { backgroundColor: C.emerald, borderColor: C.emerald },
  circleLocked:     { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" },
  circleText:       { color: C.white, fontWeight: "900", fontSize: 13 },
  stepBody:         { flex: 1 },
  stepLabel:        { color: C.white, fontWeight: "700", fontSize: 14 },
  stepLabelDone:    { color: C.slate400, textDecorationLine: "line-through" },
  stepLabelLocked:  { color: C.slate600 },
  stepDesc:         { color: C.slate500, fontSize: 12, marginTop: 2, lineHeight: 16 },
  doneBadge:        { backgroundColor: "rgba(16,185,129,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  doneBadgeText:    { color: C.emerald, fontSize: 11, fontWeight: "700" },
  lockedBadge:      { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  lockedBadgeText:  { color: C.slate600, fontSize: 11, fontWeight: "700" },
  startBadge:       { backgroundColor: "rgba(56,189,248,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  startBadgeText:   { color: C.sky, fontSize: 11, fontWeight: "700" },
  hint:             { textAlign: "center", color: C.slate600, fontSize: 12, marginTop: 16 },
});

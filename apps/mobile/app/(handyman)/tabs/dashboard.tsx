import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { api } from "@/lib/api";
import { clearAuth } from "@/lib/storage";
import { C } from "@/constants/colors";
import { SafeAreaView } from "react-native-safe-area-context";

type Profile = {
  name: string; email: string; avatarUrl: string | null;
  handymanProfile: { rating: number; totalJobs: number; totalEarnings: number; isAvailable: boolean; backgroundCheckStatus: string } | null;
};
type Checklist = { ica: boolean; profile: boolean; services: boolean; availability: boolean; backgroundCheck: boolean; stripe: boolean };

const STEP_KEYS = ["ica", "profile", "services", "availability", "backgroundCheck", "stripe"] as const;
const BG_PENDING = ["DEFERRED", "PAID", "IN_PROGRESS"];

const STEPS = [
  { key: "ica",             label: "Sign Agreement",      href: "/(handyman)/ica" },
  { key: "profile",         label: "Complete Profile",    href: "/(handyman)/onboarding-profile" },
  { key: "services",        label: "Add Services",        href: "/(handyman)/onboarding-services" },
  { key: "availability",    label: "Set Availability",    href: "/(handyman)/onboarding-availability" },
  { key: "backgroundCheck", label: "Background Check",   href: "/(handyman)/background-check" },
  { key: "stripe",          label: "Connect Payout",     href: "/(handyman)/tabs/earnings" },
] as const;

export default function HandymanDashboard() {
  const router = useRouter();
  const [profile, setProfile]     = useState<Profile | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [pRes, cRes] = await Promise.all([
      api.get("/profile"),
      api.get("/handyman/checklist"),
    ]);
    if (pRes.ok) setProfile(await pRes.json());
    if (cRes.ok) setChecklist(await cRes.json());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const logout = async () => { await clearAuth(); router.replace("/(auth)/landing" as any); };

  if (loading) return <View style={s.center}><ActivityIndicator color={C.sky} size="large" /></View>;

  const hp = profile?.handymanProfile;
  // Background check is only "complete" once admin-approves it (PASSED);
  // paid/deferred shows as "Pending".
  const bgStatus   = hp?.backgroundCheckStatus ?? "";
  const bgComplete = bgStatus === "PASSED";
  const bgPending  = BG_PENDING.includes(bgStatus);
  const isStepComplete = (key: (typeof STEP_KEYS)[number]) =>
    key === "backgroundCheck" ? bgComplete : (checklist?.[key] ?? false);
  const completedSteps = checklist ? STEP_KEYS.filter(isStepComplete).length : 0;
  const allDone = completedSteps === 6;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.sky} />}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Welcome back 👋</Text>
            <Text style={s.name}>{profile?.name?.split(" ")[0]}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={s.logoutBtn}>
            <Text style={s.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* Setup checklist */}
        {checklist && !allDone && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Complete Your Setup</Text>
            <Text style={s.cardSub}>{completedSteps} of 6 steps done</Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${(completedSteps / 6) * 100}%` as any }]} />
            </View>
            <View style={s.stepsGrid}>
              {STEPS.map(step => {
                const isBg    = step.key === "backgroundCheck";
                const done    = isStepComplete(step.key as (typeof STEP_KEYS)[number]);
                const pending = isBg && bgPending && !bgComplete;
                const label   = isBg && bgComplete ? "Background Complete"
                              : isBg && pending    ? "Background Pending"
                              : step.label;
                return (
                  <TouchableOpacity key={step.key} style={[s.stepPill, done && s.stepDone, pending && s.stepPending]}
                    onPress={() => !done && !pending && router.push(step.href as any)}
                    disabled={done || pending}>
                    <Text style={s.stepEmoji}>{done ? "✅" : pending ? "⏳" : "⭕"}</Text>
                    <Text style={[s.stepLabel, done && s.stepLabelDone]}>{label}</Text>
                    {pending && <Text style={s.pendingTag}>Under review</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Stats */}
        <View style={s.statsRow}>
          {[
            { label: "Earnings", value: `$${(hp?.totalEarnings ?? 0).toFixed(0)}`, color: C.emerald },
            { label: "Jobs",     value: String(hp?.totalJobs ?? 0),                color: C.sky },
            { label: "Rating",   value: `${(hp?.rating ?? 0).toFixed(1)} ★`,       color: C.amber },
          ].map(stat => (
            <View key={stat.label} style={s.statCard}>
              <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick actions */}
        <Text style={s.sectionTitle}>Quick Actions</Text>
        <View style={s.actionsGrid}>
          {[
            { label: "Find Jobs",       emoji: "🔍", href: "/(handyman)/tabs/find-jobs" },
            { label: "My Jobs",         emoji: "📋", href: "/(handyman)/tabs/jobs" },
            { label: "Profile",         emoji: "👤", href: "/(handyman)/tabs/profile" },
            { label: "Setup Checklist", emoji: "✅", href: "/(handyman)/setup-checklist" },
            { label: "Earnings",        emoji: "💰", href: "/(handyman)/tabs/earnings" },
          ].map(a => (
            <TouchableOpacity key={a.label} style={s.actionCard} onPress={() => router.push(a.href as any)}>
              <Text style={s.actionEmoji}>{a.emoji}</Text>
              <Text style={s.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.ink },
  scroll:        { flex: 1 },
  center:        { flex: 1, backgroundColor: C.ink, alignItems: "center", justifyContent: "center" },
  header:        { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 24, paddingBottom: 12 },
  greeting:      { color: C.slate400, fontSize: 14 },
  name:          { color: C.white, fontSize: 26, fontWeight: "900" },
  logoutBtn:     { backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  logoutText:    { color: C.red, fontSize: 13, fontWeight: "600" },
  card:          { margin: 16, backgroundColor: "#1E293B", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  cardTitle:     { color: C.white, fontWeight: "800", fontSize: 16, marginBottom: 2 },
  cardSub:       { color: C.slate400, fontSize: 13, marginBottom: 12 },
  progressTrack: { height: 6, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 3, marginBottom: 16 },
  progressFill:  { height: 6, backgroundColor: C.sky, borderRadius: 3 },
  stepsGrid:     { gap: 8 },
  stepPill:      { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  stepDone:      { backgroundColor: "rgba(16,185,129,0.05)", borderColor: "rgba(16,185,129,0.2)" },
  stepPending:   { backgroundColor: "rgba(245,158,11,0.06)", borderColor: "rgba(245,158,11,0.3)" },
  stepEmoji:     { fontSize: 16 },
  stepLabel:     { color: C.white, fontSize: 14, fontWeight: "600", flex: 1 },
  stepLabelDone: { color: C.slate400, textDecorationLine: "line-through" },
  pendingTag:    { color: C.amber, fontSize: 11, fontWeight: "700" },
  statsRow:      { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginBottom: 4 },
  statCard:      { flex: 1, backgroundColor: "#1E293B", borderRadius: 16, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  statValue:     { fontSize: 20, fontWeight: "900" },
  statLabel:     { color: C.slate400, fontSize: 11, marginTop: 2 },
  sectionTitle:  { color: C.white, fontSize: 17, fontWeight: "800", paddingHorizontal: 16, marginTop: 20, marginBottom: 10 },
  actionsGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 16, paddingBottom: 32 },
  actionCard:    { width: "47%", backgroundColor: "#1E293B", borderRadius: 16, padding: 18, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  actionEmoji:   { fontSize: 28 },
  actionLabel:   { color: C.white, fontSize: 13, fontWeight: "700", textAlign: "center" },
});
